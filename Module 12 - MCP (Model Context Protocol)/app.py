"""TripMate over MCP: every tool the agent uses comes from an MCP server.

    uv run streamlit run app.py

Two servers, two transports:
  - tripmate-tools  local subprocess over stdio      (trip_server.py: weather, check_budget)
  - tavily-mcp      remote server over streamable HTTP (web search)

Each run prints the protocol steps as they happen: spawn/connect -> initialize
-> tools/list -> tools/call (args + result) -> close.
"""
import asyncio
import json
import os
import sys
import time
from contextlib import AsyncExitStack
from pathlib import Path

import httpx
import streamlit as st
from dotenv import load_dotenv
from langchain.agents import create_agent
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, ToolMessage
from langchain_mcp_adapters.tools import load_mcp_tools
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client
from mcp.client.streamable_http import streamable_http_client

load_dotenv(Path(__file__).parent / ".env")

SERVER = Path(__file__).parent / "trip_server.py"
TAVILY_URL = "https://mcp.tavily.com/mcp/"
# Tavily exposes 5 tools; every schema sent to the LLM costs tokens, so offer only search.
TAVILY_KEEP = {"tavily_search"}

SYSTEM = (
    "You are TripMate, a travel planner. Use your tools, never invent weather:\n"
    "1. get_weather once, with the destination's latitude and longitude. Do not web-search weather.\n"
    "2. tavily_search (max_results 3) once for top attractions and once for budget stays.\n"
    "3. Estimate costs, then call check_budget once with your cost list and the user's budget. "
    "Only call it again if it says OVER.\n"
    "Then answer in markdown: Weather, Places, Stay, Budget (table with total), Day-by-day plan."
)


def cut(x, n=300) -> str:
    if isinstance(x, list):  # MCP tool results arrive as content blocks; show their text
        x = " ".join(b.get("text", "") if isinstance(b, dict) else str(b) for b in x)
    s = x if isinstance(x, str) else json.dumps(x, ensure_ascii=False)
    s = s.replace("\n", " · ")
    return s if len(s) <= n else s[:n] + " …"


def root_cause(e: BaseException) -> BaseException:
    """anyio wraps failures in ExceptionGroups; dig out the real error."""
    while isinstance(e, BaseExceptionGroup) and e.exceptions:
        e = e.exceptions[0]
    return e


async def connect(stack, name, transport, label, log) -> ClientSession:
    """Open one MCP session and log the handshake + discovery steps."""
    log(f"**Connect `{name}`** — {label}")
    read, write, *_ = await stack.enter_async_context(transport)
    session = await stack.enter_async_context(ClientSession(read, write))
    info = await session.initialize()
    log(f"↳ `initialize` → server **{info.serverInfo.name} {info.serverInfo.version}**, "
        f"protocol `{info.protocolVersion}`")
    tools = (await session.list_tools()).tools
    log(f"↳ `tools/list` → {', '.join(f'`{t.name}`' for t in tools)}")
    return session


async def plan(request: str, log) -> str:
    async with AsyncExitStack() as stack:
        local = await connect(
            stack, "tripmate-tools",
            stdio_client(StdioServerParameters(command=sys.executable, args=[str(SERVER)])),
            f"stdio: spawn `python {SERVER.name}` as a subprocess, JSON-RPC over its stdin/stdout", log)

        http = await stack.enter_async_context(httpx.AsyncClient(
            headers={"Authorization": f"Bearer {os.environ['TAVILY_API_KEY']}"}, timeout=60))
        remote = await connect(
            stack, "tavily", streamable_http_client(TAVILY_URL, http_client=http),
            f"streamable HTTP: POST JSON-RPC to `{TAVILY_URL}`", log)

        # load_mcp_tools binds each tool to the open session, so calls reuse it (no respawn).
        local_tools = await load_mcp_tools(local)
        remote_tools = [t for t in await load_mcp_tools(remote) if t.name in TAVILY_KEEP]
        tools = local_tools + remote_tools
        owner = {t.name: "tripmate-tools" for t in local_tools} | {t.name: "tavily" for t in remote_tools}
        log(f"**Hand tools to the agent** → {', '.join(f'`{t}`' for t in owner)} "
            f"(other Tavily tools withheld to save tokens)")

        agent = create_agent(init_chat_model("groq:openai/gpt-oss-120b", temperature=0), tools,
                             system_prompt=SYSTEM)
        answer, started = "", {}
        async for update in agent.astream({"messages": [("user", request)]},
                                          {"recursion_limit": 25}, stream_mode="updates"):
            for data in update.values():
                for m in (data or {}).get("messages", []):
                    if isinstance(m, AIMessage) and m.tool_calls:
                        for c in m.tool_calls:
                            started[c["id"]] = time.perf_counter()
                            log(f"**`tools/call` → {owner.get(c['name'], '?')}** · `{c['name']}` "
                                f"`{cut(c['args'], 200)}`")
                    elif isinstance(m, ToolMessage):
                        ms = (time.perf_counter() - started.get(m.tool_call_id, time.perf_counter())) * 1000
                        log(f"↳ result ({ms:.0f} ms): {cut(m.content)}")
                    elif isinstance(m, AIMessage):
                        answer = m.content
        log("**Close sessions** → stdio subprocess terminated, HTTP session ended")
        return answer


# ---------------------------------------------------------------- UI
st.set_page_config(page_title="TripMate MCP", page_icon="🔌")
st.title("🔌 TripMate over MCP")
st.caption("Every tool comes from an MCP server: a local stdio server (weather, budget check) "
           "and Tavily's remote HTTP server (web search). The protocol steps are shown live.")

request = st.text_input("Your trip", "Plan a 3-day trip to Goa, budget ₹15000")

if st.button("Plan", type="primary") and request.strip():
    with st.status("MCP steps", expanded=True) as status:
        step = iter(range(1, 1000))
        try:
            answer = asyncio.run(plan(request, lambda md: st.markdown(f"{next(step)}. {md}")))
            status.update(label="MCP steps — done", state="complete")
        except Exception as e:  # e.g. Groq daily limit, a server unreachable
            status.update(label="MCP steps — failed", state="error")
            e = root_cause(e)
            st.error(f"Planning failed: {type(e).__name__}: {e}")
            st.stop()
    st.markdown(answer)
