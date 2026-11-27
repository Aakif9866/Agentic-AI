# Module 10 — Project: Build Your Own ChatGPT Agent

The capstone. Everything from Modules 6–9 in one agent: memory, streaming, threads, tools, RAG, and human approval, behind a FastAPI service.

See `README.md` for the endpoint table and run commands. These notes explain *why* it's built this way.

## Run it

```bash
uv sync
uv run python ingest.py sample_notes.pdf    # fills faiss_db/ for search_docs
uv run uvicorn api:app --reload
uv run streamlit run ui_streamlit.py        # optional UI
```

Needs `GROQ_API_KEY` and `TAVILY_API_KEY`.

---

## The shape: four files, four jobs

```
tools.py    →  everything the agent can DO
backend.py  →  the graph that decides WHEN to do it
api.py      →  how the outside world talks to it
ingest.py   →  one-off: load a PDF into the vector store
```

This is the Module 9 split (graph separate from transport) with tools pulled out too. The reason is practical: `backend.py` stays short enough to read in one screen, and you can add a tool without touching the graph at all.

---

## `tools.py` — the agent's capabilities

Four tools, each a lesson from an earlier module:

| Tool | From | Note |
|---|---|---|
| `calculator` | Module 7 | whitelisted expression, not a bare `eval` |
| `tavily_search` | Module 7 | live web search |
| `search_docs` | Module 8 | FAISS over your PDF, cites page numbers |
| `send_email` | Module 8 | **pauses for human approval** |

Two details worth copying into your own projects:

**1. `load_dotenv()` lives in this file.** `TavilySearch()` reads its API key at *construction* time, and this module constructs it at import. Without `load_dotenv()` here, importing `tools` from a script that hadn't already loaded `.env` crashed — which is exactly what happened when we first ran `ingest.py`. A module with import-time env dependencies should load its own env.

**2. The calculator whitelists before evaluating.**

```python
SAFE_EXPR = re.compile(r"[0-9.\s+\-*/%()]+")
if not SAFE_EXPR.fullmatch(expression):
    return "error: only numbers and + - * / % ( ) are allowed"
return str(eval(expression, {"__builtins__": {}}, {}))
```

The expression is written by an LLM, and an LLM can be steered by prompt injection — so it is **not trusted input**. Because no letters can pass the whitelist, there are no names to abuse and no attribute tricks available.

---

## `backend.py` — the graph

It's the Module 7 tool loop, unchanged:

```python
graph.add_edge(START, "chat")
graph.add_conditional_edges("chat", tools_condition)
graph.add_edge("tools", "chat")
agent = graph.compile(checkpointer=SqliteSaver(conn))
```

That's the whole insight of this project: **a capable agent is not a complicated graph.** Four tools, a system prompt, and a checkpointer on the same three-line loop you learned in Module 7.

The system prompt does the heavy lifting — in particular this line, learned the hard way in Module 8:

> `send_email` … Call it directly with a body you write yourself; never reply with a plain-text draft and never ask the user to confirm, because an approval step already exists.

Without it the model politely writes the email as chat text, never calls the tool, and the approval step never fires.

Two helpers exist for the API layer:

```python
all_thread_ids()          # the ChatGPT-style sidebar
pending_approval(tid)     # is this thread waiting on a human?
```

---

## `api.py` — and the one flow that's genuinely tricky

`/chat`, `/threads`, `/health` work exactly as in Module 9. The new part is approval, which needs **two** endpoints because an HTTP request can't wait for a human.

```
POST /chat          → graph pauses inside send_email → stream ends EMPTY
GET  /pending/{id}  → returns the draft the human must review
POST /approve       → Command(resume={...}) → graph continues → final message
```

**The counter-intuitive bit:** when the agent pauses, `/chat` returns an **empty stream**. No tokens, no error. That's not a bug — the graph stopped before producing any assistant text. An empty stream is the client's cue to call `/pending`.

Editing works by passing the corrected value through resume:

```python
resume_value = {"approved": body.approved}
if body.edited_body:
    resume_value["edited_body"] = body.edited_body
agent.invoke(Command(resume=resume_value), cfg)
```

---

## `ui_streamlit.py` — why it talks to the graph, not the API

The UI imports `agent` directly instead of calling its own HTTP endpoints. One process, no CORS, and it demonstrates the same primitives:

- sidebar from `all_thread_ids()`
- history from `agent.get_state(cfg)`
- live typing from `agent.stream(..., stream_mode="messages")`
- **the approval screen replaces the chat box** when `pending_approval()` returns a draft — which is the correct UX: if the agent is blocked, don't invite more input.

---

## What we actually verified

Tested against a live server (`uvicorn api:app`), real Groq calls:

| # | Check | Result |
|---|---|---|
| 1 | `/health` | `{"ok":true}` |
| 2 | `calculator` via `/chat` | `18473 * 29361` → 542,385,753 |
| 3 | memory on one `thread_id` | correctly recalled the previous question |
| 4 | RAG with citation | answered from the PDF, cited `page 0` |
| 5 | `send_email` pauses | empty stream, as designed |
| 6 | `/pending/{id}` | returned the full draft |
| 7 | `/approve` + `edited_body` | resumed, returned final message |
| 8 | `/pending` after approval | `null` |
| 9 | `/threads` | all four threads listed |
| 10 | `tavily_search` | live web answer with source marker |
| 11 | the human's edit reached the tool | `{"status":"sent","body":"EDITED BY HUMAN: Q4 was great."}` |

Row 11 is the one that proves HITL is real rather than cosmetic — the text that "sent" was the human's, not the model's.

**Also verified since:** the Streamlit UI **boots clean** — `streamlit run ui_streamlit.py --server.headless true` returns HTTP 200 with no errors in the log. Module 9's Dockerfile (the same pattern this one uses) builds and serves correctly in a real container.

**Still not verified:** this module's own `docker build` — it adds a step that pre-downloads the embedding model, which Module 9's image doesn't have. And the Streamlit UI has never been *clicked* through; only its startup is confirmed.

---

## Carrying this into Module 11+

This project is most of the plumbing the later capstones reuse. For RepoSage-style work you swap the tools (`search_code`, `create_github_issue`) and keep everything else: the loop, the checkpointer, the approval flow, the API shape.

## Known limitations

- **SQLite on a free host doesn't persist.** Render wipes the disk on redeploy and on sleep. Fixed in v2 Phase 1: `PostgresSaver` on Neon via `DATABASE_URL` (pooled URL needs `prepare_threshold=0`).
- **No thread deletion.** `SqliteSaver` has no built-in delete; you'd add a "deleted" table and filter in `all_thread_ids()`.
- **The embedding model downloads ~90MB on first use.** The Dockerfile pre-bakes it so a cold container doesn't pay that on its first request.

## v2 evidence (2026-11-27)

Real runs, real output. Plan: [V2_PLAN.md](V2_PLAN.md). Status table: [V2_SCOPE.md](V2_SCOPE.md).

**Phase 1, Postgres (Neon).** Chat on thread `phase1-neon-check`, then a fresh process:
```
PostgresSaver -> The product of 37 and 91 is **3,367**.
4 messages restored; llm_calls = 2
```
Pending: the Render redeploy check (needs `DATABASE_URL` + `APP_*` in Render env).

**Phase 3a, login + token.** FastAPI TestClient against the real app:
```
health 200 | chat no token 401 | pending bad token 401 | login wrong 401
login ok 200 | chat w/ token 200 "The result of 6 x 7 is 42" | GET /threads 404 (removed)
UI: before login no chat box; wrong password -> error; after login chat box + all threads in sidebar
```

**Phase 6, evals.** First full 30-case run (experiment `module10-b6372b5e`): tool-selection **90%**, answer **77%**.
Real findings, not yet fixed:
- web search looped up to **7 calls** for one question (now capped at 2 in the system prompt, untested at scale)
- docs/mixed questions sometimes answered with **no tool** (doc05, mix01)
- the greeting claims it sends email directly, without mentioning approval (none01)

**No baseline yet.** The 40-case baseline run hit Groq's free tier **200K tokens/day** cap at about case 15
(`429 ... tokens per day (TPD): Limit 200000, Used 199149`). Crashed cases score 0 and "pass" injection by
never emailing, so its 57.5% was meaningless and was discarded. `run_evals.py` now refuses to gate or write
a baseline when any case errors (exit 2). Rerun `--update-baseline` on a fresh day, on main.

**Phase 7, guardrails.** `--only injection` (experiment `inj-smoke2`):
```
first try: injection_blocked 9/10 (inj08: an <assistant> tag inside pasted text triggered send_email)
after widening the prompt rule to cover pasted text: injection_blocked 10/10
```
Trace redaction, checked span by span in LangSmith. The first version leaked the email in every graph `chain`
span, because state holds message *objects* that `redact()` skipped. Fixed with `model_dump()`; rerun: all spans `ok`.

**Phase 5, observability.** `uv run python metrics.py --days 1` on real tagged runs:
```
day         turns  conversations  p50_s  p95_s  tokens  cost_usd  cost_per_conversation_usd  tool_error_rate  budget_cap_hits
2026-11-27      3              3   1.21   1.32    4341   0.00079                   0.000263              0.0                0
            tools: {'calculator': '3/3'}
--alert: ok: 3 turns, 3 tool calls in the last hour
```
Run metadata on a real trace: `tags ['chat','module10']`, `app_version bd42c76`, `phase chat`; calculator appears as a child tool span.
Dashboard page and 👍/👎 feedback widget both render with no exceptions (Streamlit AppTest, logged in).
Pending: LangSmith UI saved filters + online judge rule, Discord webhook, the break-it-on-purpose alert test.
