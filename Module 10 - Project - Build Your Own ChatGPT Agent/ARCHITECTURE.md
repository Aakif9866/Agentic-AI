# Architecture — ChatGPT-style Agent (Module 10)

The capstone combining Modules 6–9. This document covers components, data flow, integrations, error paths, security boundaries and the design decisions behind them.

---

## 1. Components and responsibilities

| File | Responsibility | Must NOT |
|---|---|---|
| `tools.py` | Everything the agent can *do*: arithmetic, web search, PDF retrieval, email-with-approval. Owns the embedding model and vector store path. | know anything about HTTP or the graph |
| `backend.py` | The graph: nodes, edges, the system prompt, the checkpointer (Postgres or SQLite), the budget and search caps, `run_config()` for traced runs. Exposes `agent`, `checkpointer`, `run_config()`, `all_thread_ids()`, `thread_title()`, `pending_approval()`. | import FastAPI |
| `api.py` | HTTP transport only: request/response shapes, streaming, endpoint routing, the Bearer-token check. | contain agent logic |
| `ingest.py` | One-off: PDF → FAISS index. | run at request time |
| `ui_streamlit.py` | The public app (what Docker serves). Talks to the graph **directly**, not via HTTP; owns the login gate, the rate limit UI, 👍/👎 feedback and chat deletion. | be required for the API to work |
| `auth.py` (v2) | The single login and stateless HMAC tokens. Stdlib only. | store sessions server-side |
| `redact.py` (v2) | Scrubs emails/phones from anything sent to LangSmith. Stdlib only. | change what the agent itself sees |
| `metrics.py` + `pages/dashboard.py` (v2) | Metrics and alert rules computed from LangSmith runs tagged `module10`. Light imports (no torch). | import `backend` |
| `evals/` (v2) | 40-case offline suite + PR gate, run as LangSmith experiments; builds its own poisoned index in a temp dir. | touch the real chat DB (forces in-memory SQLite) |

**The load-bearing decision:** `backend.py` imports no web framework. That's why Module 15's eval harness and Module 16's test suite can `from backend import agent` without starting a server.

---

## 2. Component diagram

```mermaid
graph TD
    subgraph Clients
        UI[ui_streamlit.py]
        HTTP[HTTP client / curl]
    end

    subgraph Transport
        API[api.py<br/>FastAPI]
    end

    subgraph Core
        BE[backend.py<br/>StateGraph + budget cap]
        CP[(Postgres on Neon / chatbot.db<br/>PostgresSaver / SqliteSaver)]
    end

    subgraph Tools["tools.py"]
        CALC[calculator<br/>regex-whitelisted eval]
        WEB[tavily_search]
        DOCS[search_docs]
        MAIL[send_email<br/>interrupt]
    end

    subgraph External
        GROQ[Groq API]
        TAV[Tavily API]
        FAISS[(faiss_db/)]
        HF[HuggingFace<br/>MiniLM weights]
    end

    HTTP --> API --> BE
    UI -.direct import.-> BE
    BE <--> CP
    BE --> CALC & WEB & DOCS & MAIL
    BE --> GROQ
    WEB --> TAV
    DOCS --> FAISS
    DOCS --> HF
```

---

## 3. Data flow — a normal turn

```mermaid
sequenceDiagram
    participant C as Client
    participant A as api.py
    participant G as backend graph
    participant T as ToolNode
    participant L as Groq

    C->>A: POST /chat {thread_id, message}
    A->>G: stream(messages, thread_id, recursion_limit=25)
    G->>G: budget check (llm_calls < cap?)
    G->>L: chat_node → model call
    L-->>G: AIMessage with tool_calls
    G->>T: tools_condition routes to tools
    T-->>G: ToolMessage results
    G->>L: chat_node again, now with results
    L-->>G: final AIMessage (no tool_calls)
    G-->>A: token stream
    A-->>C: text/plain chunks
    Note over G: state checkpointed after EVERY node
```

**Key property:** state is saved after each node, keyed by `thread_id`. Memory, time travel and crash recovery are all consequences of that one mechanism, not separate features.

---

## 4. Data flow — the approval path

This is the only flow that cannot complete in one request, because a human has to intervene.

```mermaid
sequenceDiagram
    participant C as Client
    participant A as api.py
    participant G as graph
    participant T as send_email tool

    C->>A: POST /chat "email the team about Q4"
    A->>G: stream(...)
    G->>T: send_email(to, subject, body)
    T->>T: interrupt({...}) → checkpoint saved
    T--xG: execution halts
    G-->>A: stream ends EMPTY
    A-->>C: (no tokens)
    Note over C: empty stream = "check /pending"
    C->>A: GET /pending/{thread_id}
    A-->>C: {pending: {to, subject, body}}
    C->>A: POST /approve {approved, edited_body}
    A->>G: invoke(Command(resume={...}))
    G->>T: interrupt() RETURNS the decision
    T-->>G: {"status": "sent", body: edited} (simulated until Gmail, Phase 3b)
    G-->>A: final message
    A-->>C: {final_message}
```

**The counter-intuitive part:** `/chat` returns an **empty stream** when the agent pauses. Not an error — the graph stopped before producing assistant text. An empty stream is the client's signal to poll `/pending`.

**ADR-adjacent note:** the alternative was holding the HTTP request open until a human answered. Rejected — it would tie up a worker indefinitely and die on any timeout or page refresh. Two endpoints plus a checkpoint is stateless and survives a client restart.

---

## 5. State schema

```python
class ChatState(MessagesState):   # MessagesState provides `messages` + add_messages reducer
    llm_calls: int                # budget counter, added by Module 15's audit
```

| Field | Reducer | Why |
|---|---|---|
| `messages` | `add_messages` (appends, dedupes by id) | conversation history; appending is what makes replay safe |
| `llm_calls` | default (last write wins) | a counter only ever written by one node |

Threads are isolated by `thread_id`; two threads never see each other's state.

---

## 6. External integrations

| Service | Used by | Failure mode | Handling |
|---|---|---|---|
| **Groq** | `backend.py` | dead model → 404; rate limit → 429; invalid tool args → 400 `tool_use_failed` | 400 `tool_use_failed`: error fed back, one retry, then a polite reply (v2). Others **not handled**: propagate as a 500. See §9. |
| **DeepSeek** (evals) | `evals/run_evals.py` | thinking mode + tools needs reasoning passed back, or 400 | thinking disabled via `backend.model_kwargs()` |
| **LangSmith** | `run_config()`, `metrics.py`, feedback | down / no key | tracing off unless `LANGSMITH_TRACING=true`; feedback errors become a toast, never break the chat |
| **Tavily** | `tools.py:web_search` | missing key at *construction* time | `load_dotenv()` lives in `tools.py` because the key is read at import |
| **HuggingFace** | `tools.py:EMBEDDINGS` | ~90MB download on first use | Dockerfile pre-bakes it so cold containers don't pay it |
| **FAISS** (local) | `search_docs` | index absent | returns `"No document has been uploaded yet."` as text |
| **Postgres** (Neon) / SQLite fallback | checkpointer | SQLite is wiped on free-tier redeploy | v2 Phase 1: `PostgresSaver` when `DATABASE_URL` is set |

---

## 7. Error paths

The governing rule, from Module 7: **tools return errors as strings; they never raise.** A raise aborts the whole graph run; a returned string goes back to the model, which can read it and retry.

| Failure | Behaviour |
|---|---|
| Bad arithmetic expression | `"error: only numbers and + - * / % ( ) are allowed"` |
| `eval` throws | `"error: {e}"` |
| No FAISS index | `"No document has been uploaded yet."` |
| No relevant chunks | `"No relevant passages found."` |
| Budget exhausted | polite `AIMessage`, **no model call spent** |
| Runaway tool loop | `recursion_limit=25`, plus the budget cap bounds it |
| Too many web searches | after `MAX_SEARCHES_PER_TURN` (2), the model answers from a flattened, tool-free prompt (v2) |
| Model invents a tool argument | Groq 400 `tool_use_failed` → error fed back, one retry, then a polite message (v2) |
| Tool *returns* an error | the model reads it; `metrics.tool_failed()` counts it as a failure (v2) |
| Groq unavailable | ⚠️ unhandled — 500 to the client |

---

## 8. Security boundaries

```mermaid
graph LR
    U[User input] -->|untrusted| M[Model]
    M -->|also untrusted:<br/>prompt injection can steer it| TA[Tool args]
    TA --> W{whitelist}
    W -->|pass| E[eval, no builtins]
    W -->|reject| R[error string]
    M --> SE[send_email] --> H{human approval}
    H -->|approved| S[send]
    H -->|rejected| X[cancelled]
```

| Boundary | Control |
|---|---|
| **LLM-generated expressions** | `SAFE_EXPR = [0-9.\s+\-*/%()]+` whitelist **before** `eval`, with `{"__builtins__": {}}`. No names can appear, so no attribute tricks. |
| **Irreversible actions** | `send_email` requires `interrupt()` approval; the human may edit the body first |
| **Secrets** | `.env` only; gitignored; excluded via `.dockerignore`; never baked into the image |
| **Deserialization** | `allow_dangerous_deserialization=True` is required by FAISS — acceptable only because *we* built the index. Never load a downloaded one. |
| **Spend** | `MAX_LLM_CALLS_PER_THREAD`, checked before the call; `MAX_SEARCHES_PER_TURN` |
| **Access** (v2) | one login from env vars, fails closed; API needs a 24 h HMAC Bearer token; `GET /threads` removed |
| **Prompt injection** (v2) | system rule: tool output and pasted text are data; `search_docs` output wrapped in `<untrusted_document>`; `EMAIL_ALLOWLIST` checked in code before approval. 10/10 eval cases blocked |
| **Trace privacy** (v2) | `redact()` on every span's inputs/outputs, including LangChain message objects |

**Known gap:** `tavily_search` and `search_docs` run ungated (by design: they're read-only). Only the one irreversible action is gated. That's a deliberate line, recorded in Module 15's audit (row 5) rather than enforced in code.

---

## 9. Design decisions and trade-offs

| Decision | Alternative | Why this way |
|---|---|---|
| `backend.py` free of web code | one file | lets evals/tests import the agent without a server — used by Modules 15 and 16 |
| Retrieval as a **tool** | a node that always retrieves | "Hi there!" shouldn't trigger a vector search. Verified in Module 8. |
| Approval **inside** the tool | approval in the conversation | attaches the gate to the dangerous action, so it can't be routed around |
| `SqliteSaver` | `InMemorySaver` | survives restarts; the cost is it doesn't survive free-tier redeploys |
| Whitelist + `eval` | a parser or `ast` walker | 5 lines, genuinely safe here, no dependency |
| Python sums the budget | ask the model | models miscount; the cap must be exact |
| Provider via env var | hardcoded model | one flip to OpenAI — see [`../OpenAI.md`](../OpenAI.md) |
| Streamlit imports the graph | calls its own API | one process, no CORS, same primitives |

### Accepted limitations

1. ~~**No verification of answers**~~ — **fixed in v2:** 40-case eval suite with LLM-as-judge, gating PRs (`evals/`).
2. **No context trimming** — history grows forever; Module 7's `trim_messages` exists but isn't wired in. The 12-call budget is the only bound. *Still open.*
3. ~~**No thread deletion**~~ — **fixed in v2:** sidebar button + `DELETE /threads/{id}`.
4. ~~**No local observability**~~ — **fixed in v2:** tagged, redacted traces; `metrics.py` (latency, tokens, cost, tool success); dashboard; hourly alert. Still needs LangSmith enabled.
5. ~~**SQLite on free hosts is ephemeral.**~~ — **fixed in v2:** `PostgresSaver` on Neon.

All five were originally recorded with `file:line` evidence in [`../Module 15 - Harness & Loop Engineering/HARNESS_REVIEW.md`](../Module%2015%20-%20Harness%20&%20Loop%20Engineering/HARNESS_REVIEW.md).

---

## 10. Setup, run, test

```bash
uv sync
uv run python ingest.py sample_notes.pdf     # populate faiss_db/
uv run uvicorn api:app --reload              # API on :8000
uv run streamlit run ui_streamlit.py         # optional UI

MAX_LLM_CALLS_PER_THREAD=3 uv run python budget_demo.py   # budget guard
```

Required: `GROQ_API_KEY`, `TAVILY_API_KEY`, and for login `APP_USERNAME`, `APP_PASSWORD`, `APP_SECRET`. Optional: `DATABASE_URL`, `CHAT_MODEL`, `EMBED_MODEL`, `CHECKPOINT_DB`, `MAX_LLM_CALLS_PER_THREAD`, `MAX_SEARCHES_PER_TURN`, `EMAIL_ALLOWLIST`, `LANGSMITH_*`. Every API route except `/login` and `/health` needs `Authorization: Bearer <token>`.

**Verified** (live server, real APIs): `/health`; streaming `/chat`; memory across calls on one `thread_id`; thread isolation; calculator; RAG with page citations; `send_email` pause → `/pending` → `/approve` with `edited_body` reaching the tool; the budget cap; Streamlit boots clean (HTTP 200).

**Verified in v2** (2026-11-27, see NOTES.md): Postgres persistence across processes; login/token 401s; `/threads` removed and `DELETE /threads/{id}` added; trace redaction span by span; 40-case eval baseline and gate failure on a broken prompt; alert firing on a broken Tavily key; Streamlit UI driven through login, chat, feedback, delete and dashboard with AppTest.

**Verified on Vercel:** health 200, WebSocket upgrade 101, and a Streamlit-protocol probe rendering the Sign-in form with no exceptions (https://agentic-chat-sepia.vercel.app).

**Not verified:** real Gmail sending (Phase 3b); a chat surviving a Vercel redeploy (Postgres persistence itself is verified locally). The UI has been driven programmatically (Streamlit AppTest), not clicked through by hand on the live URL.

## 11. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Empty `/chat` response | agent paused for approval | poll `/pending/{thread_id}` — working as designed |
| `"No document has been uploaded yet."` | `faiss_db/` missing | `uv run python ingest.py sample_notes.pdf` |
| `"...reached its budget..."` | thread hit the cap | new `thread_id`, or raise `MAX_LLM_CALLS_PER_THREAD` |
| `Did not find tavily_api_key` | key read at import | set `TAVILY_API_KEY`; `tools.py` loads its own env |
| `model ... decommissioned` | Groq retired it | check the live list — `AGENT_RULES.md` #1 |
| Threads vanished after deploy | free-tier disk wipe | set `DATABASE_URL` (`PostgresSaver`) |
| Sign-in always says "Wrong username or password" | `APP_USERNAME`/`APP_PASSWORD`/`APP_SECRET` unset on the host | add all three to the host's env vars (fails closed by design) |
| Vercel deploy "succeeds" in ~100 ms, site 404s | project not on the Container preset | `vercel project update --framework container --yes`, redeploy |
| Groq 400 `Tool choice is none, but model called a tool` | calling the model without tools while tool history/names are visible | flattened, tool-free prompt (`answer_from_results`) |
| Eval run exits 2 | a case errored (often Groq's 200K tokens/day cap) | rerun later, or use `CHAT_MODEL`/`JUDGE_MODEL=deepseek:deepseek-flash` |
| Dimension mismatch after switching embeddings | 384 vs 1536 | `rm -rf faiss_db && uv run python ingest.py ...` |
