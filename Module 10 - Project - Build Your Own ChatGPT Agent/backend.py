import os
import sqlite3
import threading
import time
from collections import defaultdict, deque
from dotenv import load_dotenv
from langchain.chat_models import init_chat_model
from langchain_core.messages import AIMessage, SystemMessage
from langgraph.graph import StateGraph, START, MessagesState
from langgraph.prebuilt import ToolNode, tools_condition
from langgraph.checkpoint.sqlite import SqliteSaver

from tools import ALL_TOOLS

load_dotenv()

SYSTEM = SystemMessage(content=(
    "You are a helpful assistant with tools.\n"
    "- `calculator` for math — always use it instead of doing arithmetic yourself.\n"
    "- `tavily_search` for current events or facts you're unsure of.\n"
    "- `search_docs` for questions about the user's uploaded PDF — always cite page numbers.\n"
    "- `send_email` to send email. Call it directly with a body you write yourself; never "
    "reply with a plain-text draft and never ask the user to confirm, because an approval "
    "step already exists.\n"
    "Answer directly when no tool is needed."
))

DB_PATH = os.getenv("CHECKPOINT_DB", "chatbot.db")

# Budget cap (added in Module 15's harness audit — see Module 15/HARNESS_REVIEW.md).
# Counted per thread and checkpointed with the rest of state, so it survives restarts.
# Set high to effectively disable, which is what the pre-fix behaviour was.
MAX_LLM_CALLS_PER_THREAD = int(os.getenv("MAX_LLM_CALLS_PER_THREAD", "12"))

# Provider is configuration, not code. Default stays Groq (free tier); set
# CHAT_MODEL=openai:gpt-4o-mini to switch. See ../OpenAI.md.
CHAT_MODEL = os.getenv("CHAT_MODEL", "groq:openai/gpt-oss-120b")

llm = init_chat_model(CHAT_MODEL).bind_tools(ALL_TOOLS)


class ChatState(MessagesState):
    llm_calls: int


def chat_node(state: ChatState) -> dict:
    used = state.get("llm_calls", 0)
    if used >= MAX_LLM_CALLS_PER_THREAD:
        # Refuse *before* spending anything. This also caps a runaway chat->tools->chat
        # loop, since every pass through this node costs one model call.
        return {
            "messages": [
                AIMessage(
                    f"This conversation has reached its budget of "
                    f"{MAX_LLM_CALLS_PER_THREAD} model calls. Start a new thread to continue."
                )
            ]
        }

    msgs = state["messages"]
    if not isinstance(msgs[0], SystemMessage):
        msgs = [SYSTEM, *msgs]
    return {"messages": [llm.invoke(msgs)], "llm_calls": used + 1}


graph = StateGraph(ChatState)
graph.add_node("chat", chat_node)
graph.add_node("tools", ToolNode(ALL_TOOLS))
graph.add_edge(START, "chat")
graph.add_conditional_edges("chat", tools_condition)
graph.add_edge("tools", "chat")

# Postgres (Neon) when DATABASE_URL is set, so chats survive Render redeploys.
# SQLite stays as the fallback for CI/evals and offline dev.
DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    from langgraph.checkpoint.postgres import PostgresSaver
    from psycopg_pool import ConnectionPool

    # prepare_threshold=0: Neon's pooled URL goes through PgBouncer, which breaks
    # server-side prepared statements.
    pool = ConnectionPool(
        DATABASE_URL, kwargs={"autocommit": True, "prepare_threshold": 0}, open=True
    )
    checkpointer = PostgresSaver(pool)
    checkpointer.setup()  # idempotent: creates/migrates tables, safe on every boot
else:
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    checkpointer = SqliteSaver(conn)
agent = graph.compile(checkpointer=checkpointer)


def all_thread_ids() -> list[str]:
    return sorted({c.config["configurable"]["thread_id"] for c in checkpointer.list(None)})


def pending_approval(thread_id: str) -> dict | None:
    """The draft a human still has to approve on this thread, or None."""
    snapshot = agent.get_state({"configurable": {"thread_id": thread_id}})
    found = [i for task in snapshot.tasks for i in task.interrupts]
    return found[0].value if found else None


# Abuse guard for the public app: N questions per visitor per rolling hour.
# ponytail: in-memory and single-process, so it resets on restart/redeploy and is
# per-IP (shared Wi-Fi shares a quota). Move to Redis if this ever runs >1 instance.
RATE_LIMIT_PER_HOUR = int(os.getenv("RATE_LIMIT_PER_HOUR", "15"))
_hits: dict[str, deque] = defaultdict(deque)
_hits_lock = threading.Lock()


def rate_limit(key: str, consume: bool = True, now: float | None = None) -> tuple[bool, int, int]:
    """(allowed, questions_left, seconds_until_a_slot_frees). consume=False only peeks."""
    now = time.time() if now is None else now
    with _hits_lock:
        q = _hits[key]
        while q and q[0] <= now - 3600:
            q.popleft()
        if len(q) >= RATE_LIMIT_PER_HOUR:
            return False, 0, int(q[0] + 3600 - now) + 1 if q else 3600  # cap=0: closed
        if consume:
            q.append(now)
        return True, RATE_LIMIT_PER_HOUR - len(q), 0
