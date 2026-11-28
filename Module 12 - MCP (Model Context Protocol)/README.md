# Module 12 — MCP (Model Context Protocol)

> **Built and verified** (`notes_server.py`, `client.py`, `README_MCP.md`, `NOTES.md`). The plan below is kept as the spec.
>
> **Study order:** finish [Module 11 — TripMate AI](../Module%2011%20-%20Project%20-%20TripMate%20AI%20%28Multi-Agent%20Travel%20Planner%29/README.md) first → do the notes server below → then read the [example project](#example-project--tripmate-ai-using-mcp) at the bottom, which is the same TripMate idea rebuilt on MCP.

## Live app — TripMate over MCP

**Live: https://tripmate-mcp.vercel.app** — public, no login. Each plan spends Groq free-tier tokens (200k/day) and Tavily credits.

Every tool the agent uses comes from an MCP server, and each run lists the protocol steps on the page as they happen:

1. **Connect `tripmate-tools`**: [app.py](app.py) spawns [trip_server.py](trip_server.py) as a subprocess and speaks JSON-RPC over its stdin/stdout (**stdio**).
2. **Connect `tavily`**: POSTs JSON-RPC to Tavily's hosted server at `https://mcp.tavily.com/mcp/` (**streamable HTTP**). The key goes in an `Authorization: Bearer` header, not the URL.
3. `initialize` on each server → server name, version and protocol version.
4. `tools/list` on each → `get_weather`, `check_budget` and Tavily's 5 tools. Only `tavily_search` is handed to the agent, because every tool schema costs tokens.
5. `tools/call` for each step the agent takes, shown with its arguments, result and time.
6. Close: the subprocess is terminated and the HTTP session ends.

| Server | Transport | Tools | Key |
|---|---|---|---|
| `tripmate-tools` ([trip_server.py](trip_server.py)) | stdio, same container | `get_weather` (Open-Meteo, by coordinates), `check_budget` | none |
| `tavily-mcp` | streamable HTTP, remote | `tavily_search` | `TAVILY_API_KEY` |

Two fixes that came from real runs:
- `get_weather` takes **latitude/longitude**, not a city name. Open-Meteo's name lookup mapped "Goa" to Genoa, Italy.
- `check_budget` returns a **verdict** ("within budget, write the final answer now"), not just a number. With a bare sum, gpt-oss kept re-checking the same plan until it hit the recursion limit.

```bash
uv run streamlit run app.py                                      # local
npx vercel@67.0.0 link --yes --project tripmate-mcp
npx vercel@67.0.0 project update --framework container --yes     # else Vercel serves 404
printf '%s' "$KEY" | npx vercel@67.0.0 env add GROQ_API_KEY --environment production   # same for TAVILY_API_KEY
npx vercel@67.0.0 deploy --prod --yes
```

[Dockerfile.vercel](Dockerfile.vercel) serves the app on port 80; [.vercelignore](.vercelignore) keeps `.env`, `.venv` and the example project out of the upload.

**Verified (2026-11-28):** a local Goa run made 4 tool calls (weather → 2 searches → one budget check, ₹5000 of ₹15000) and closed both sessions cleanly. On the live site, health and the page return 200; a full trip there has not been run yet.

## Goal in one line

Build **one** MCP server and call it from **two different clients** (your LangGraph agent *and* Claude Desktop/Cursor) — proving the protocol really does make tools reusable across apps.

## Why this module exists

Up to now, every tool you wrote was locked inside one Python script. MCP is a standard that lets a tool live in its own process and be used by *any* MCP-aware app. That's the whole point: write `add_note` once, use it from your agent, from Claude Desktop, from Cursor.

**This is the module where the "proof" step is the actual lesson.** Running `client.py` is easy. Registering the server in Claude Desktop and calling it from there is what demonstrates MCP exists for a reason.

## Setup

```bash
cd "Module 12 - MCP (Model Context Protocol)"
uv init --no-readme --name module12-mcp --python 3.12
rm main.py
uv add mcp langchain-mcp-adapters langgraph==1.2.0 langchain==1.3.1 langchain-groq python-dotenv
cp "../Module 10 - Project - Build Your Own ChatGPT Agent/.env" .env
```

## Files to create

```
notes_server.py   the MCP server (FastMCP) with add_note + search_notes
client.py         LangGraph agent connecting over stdio
README_MCP.md     the claude_desktop_config.json snippet + transport explainer
NOTES.md          your own notes afterwards
```

## Requirements

- **`notes_server.py`** using `FastMCP` with at least two tools: `add_note`, `search_notes`. In-memory storage (a dict or list) is fine — this module is about the protocol, not persistence.
- **`client.py`** using `langchain-mcp-adapters`' `MultiServerMCPClient`:
  - connect over **stdio**
  - `await client.get_tools()`
  - run an **async** agent (`create_agent` + `await agent.ainvoke(...)`)
  - one conversation that saves a note *and then* searches for it
- **`claude_desktop_config.json` snippet** in a README (just the JSON block as documentation — do not auto-install it).
- A comment block explaining **when to use `stdio` vs `streamable-http`**: stdio = local subprocess on the same machine; streamable-http = server runs remotely / is shared.

## Acceptance criteria

- [ ] `uv run python client.py` round-trips: saves a note, retrieves it by keyword, prints to console.
- [ ] **You** (not the agent) add the server to Claude Desktop's MCP config and successfully call `add_note` from Claude Desktop's own chat. Skipping this skips the module's point.

## Pitfalls specific to this module

- **This module is `async`, unlike everything before it.** `client.py` needs `asyncio.run(main())` and `await` on the agent. Mixing sync `invoke` with MCP's async client is the most common first failure.
- **stdio means the server is launched as a subprocess by the client**, so the server's command/args in the config must be absolute paths or resolvable from the client's working directory. "It works in my terminal but not in Claude Desktop" is almost always this.
- Claude Desktop's config lives at `~/Library/Application Support/Claude/claude_desktop_config.json` on macOS. You must **fully restart** Claude Desktop after editing it.
- The server must write **nothing** to stdout except MCP protocol messages. A stray `print()` in your server corrupts the stream — use `logging` to stderr instead.

## Further steps & ideas

- Swap in-memory storage for SQLite so notes survive restarts.
- Add a third tool `delete_note` and see it appear in Claude Desktop without touching the client.
- Point the same server at Cursor as well — two clients, one server, zero code changes.
- Try `streamable-http`: run the server with an HTTP transport and connect from `MultiServerMCPClient` over a URL. That's how you'd share one tool server with a team.
- Wrap a tool you already own (Module 8's `search_docs`) as an MCP server so your PDF search works inside Claude Desktop.

## Example project — TripMate AI using MCP

**Code:** [`tripmate_mcp_example/`](tripmate_mcp_example/), a verbatim copy of https://github.com/entbappy/TripMate-AI-Using-MCP at commit `72abe07` (MIT, `LICENSE` kept). The only thing left out is `excalidraw_files/` (33 MB of diagrams); view those on GitHub. The copy is left unmodified, so the issues listed below are still in the code.

**Verified (2026-11-28):** `custom_weather_mcp_server.py` starts over stdio and lists `get_current_weather` + `get_forecast`. The full app has **not** been run: it needs Postgres plus AviationStack and OpenWeather keys, which this repo doesn't have.

It's the Module 11 travel planner rebuilt so each agent gets its data from **MCP servers** instead of in-process tools. Read it once you've done Module 11 and the notes server above. By then every piece should look familiar.

### How it maps to what you've built

| TripMate-MCP piece | What it shows | Where you met it |
|---|---|---|
| `custom_weather_mcp_server.py` | Your own FastMCP server (`get_current_weather`, `get_forecast`) wrapping OpenWeatherMap | `notes_server.py` here; weather agent in M11 |
| `mcp_client.py` → `MultiServerMCPClient` with **3 servers** | One client, many servers, **mixed transports** | `client.py` here (one server) |
| `tavily` server: `streamable_http` to `https://mcp.tavily.com/mcp/` | A **remote, hosted** MCP server: nothing to run locally | the stdio vs streamable-http note above |
| `aviationstack` server: `uvx aviationstack-mcp` over stdio | Using a **third-party** MCP server you didn't write | — new |
| `backend.py` → flight / hotel / weather / itinerary agents in LangGraph | Multi-agent graph whose specialists call MCP tools | M11 supervisor + specialists |
| `app.py` + `templates/` + Postgres checkpointer | FastAPI web UI and persistent threads | M6 threads, M9/M10 deploy shape |

### Things to notice (it trips on lessons this course already learned)

- **New subprocess per call.** Each helper calls `client.get_tools()`, and `backend.py` wraps each call in `asyncio.run(...)` inside sync nodes. That spawns a fresh stdio server every time. It works here only because the weather server is stateless. See the "Critical bug/lesson" in [`NOTES.md`](NOTES.md): a stateful server would silently lose its data.
- **Dead model name.** It uses `llama-3.3-70b-versatile`, which Groq has decommissioned. Swap in `openai/gpt-oss-120b` (see `../AGENT_RULES.md`).
- **The API key sits in a URL.** Tavily's key goes in the query string (`?tavilyApiKey=...`), so it can leak into logs. Fine for a demo; note it.
- **`pip` + `requirements.txt`.** If you run it, use `uv` instead: `uv init`, then `uv add -r requirements.txt`.
- **Heavier setup than anything so far:** PostgreSQL plus 4 keys (Groq, Tavily, AviationStack, OpenWeather). You don't need to run it to learn from it. Reading `mcp_client.py` + `custom_weather_mcp_server.py` covers the MCP part.

### Suggested exercise (optional, after the notes server works)

Take **your** Module 11 `main.py` and move only the weather tool into a FastMCP server, loaded through `MultiServerMCPClient` with one `client.session(...)` held open for the run. Same graph, same output; the tool now lives in its own process. Then register that server in Claude Desktop too: two clients, one weather tool.
