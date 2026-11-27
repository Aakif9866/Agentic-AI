# Module 10 — ChatGPT-style Agent (capstone for Modules 6–9)

Everything from Modules 6–9 in one agent: memory, streaming, threads, tools, RAG, and human approval. The app is a Streamlit UI (Klyro "Spectrum" theme); a FastAPI service exposes the same agent as JSON.

## Run it

```bash
uv sync
uv run python ingest.py sample_notes.pdf      # fills faiss_db/ for the search_docs tool
uv run streamlit run ui_streamlit.py          # the app, on :8501 (this is what Docker serves)
uv run uvicorn api:app --reload               # optional JSON API on :8000
uv run python test_rate_limit.py              # limiter self-check
```

Needs `GROQ_API_KEY` and `TAVILY_API_KEY` in `.env`.

## What it runs on

| Piece | Service | Configured by |
|---|---|---|
| LLM | Groq, `openai/gpt-oss-120b` (free tier) | `CHAT_MODEL` (e.g. `openai:gpt-4o-mini`) |
| Web search | Tavily | `TAVILY_API_KEY` |
| PDF search | FAISS + `all-MiniLM-L6-v2`, runs locally, no API | `EMBED_MODEL` |
| Memory | LangGraph `PostgresSaver` on Neon when `DATABASE_URL` is set, else `SqliteSaver` → `chatbot.db` | `DATABASE_URL`, `CHECKPOINT_DB` |
| Tracing | LangSmith (optional) | `LANGSMITH_*` |

## Abuse limits

| Limit | Default | Env var |
|---|---|---|
| Questions per visitor (IP) per rolling hour | 15 | `RATE_LIMIT_PER_HOUR` (0 closes the app) |
| Model calls per conversation | 12 | `MAX_LLM_CALLS_PER_THREAD` |
| Message length | 2000 chars | — |

The hourly limit lives in memory, so it resets on redeploy, and it only applies in the Streamlit app (not the JSON API). **Login (v2 Phase 3):** the app and the API sit behind one username/password from env vars (`APP_USERNAME`, `APP_PASSWORD`, `APP_SECRET`; see [auth.py](auth.py)). If any is unset, nobody can log in. After login the sidebar lists every chat; the thread id lives in the URL (`?t=...`), so a refresh keeps the conversation.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/login` | `{username, password}` → `{token}` (valid 24 h). Every route below except `/health` needs `Authorization: Bearer <token>`, else 401 |
| POST | `/chat` | Streams the reply token by token. Body: `{thread_id, message}` |
| GET | `/pending/{thread_id}` | The draft awaiting human approval, or `null` |
| POST | `/approve` | Resumes a paused thread. Body: `{thread_id, approved, edited_body?}` |
| GET | `/health` | `{"ok": true}` — what Render and CI poll |

## Tools the agent can call

- `calculator` — arithmetic, whitelisted expression (no bare `eval`)
- `tavily_search` — live web search
- `search_docs` — FAISS search over the ingested PDF, cites page numbers
- `send_email` — **pauses for human approval**, and the human can edit the body first

## The one flow worth understanding

Asking the agent to send an email does **not** return text. It pauses:

```bash
curl -N -X POST localhost:8000/chat -H 'Content-Type: application/json' \
  -d '{"thread_id":"t1","message":"Email team@company.com about Q4, subject Q4 Results."}'
# -> empty stream, because the graph paused inside the tool

curl localhost:8000/pending/t1
# -> {"pending":{"action":"send_email","to":"...","body":"<draft>"}}

curl -X POST localhost:8000/approve -H 'Content-Type: application/json' \
  -d '{"thread_id":"t1","approved":true,"edited_body":"My edited text."}'
# -> {"final_message":"The email has been sent."}
```

An empty `/chat` stream means "check `/pending`" — that is the client's cue, not a bug.

## v2: evals, observability, guardrails

| What | Command / where | File |
|---|---|---|
| Eval suite (40 cases, LangSmith experiment) | `uv run python evals/run_evals.py` (`--quick 8`, `--only injection`, `--update-baseline`) | [evals/run_evals.py](evals/run_evals.py) |
| CI gate on every PR (fails on >5pt tool-accuracy drop) | runs on DeepSeek V4.1-Flash (~$0.01–0.06 per run); needs repo secrets `DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `LANGSMITH_API_KEY`. Locally: `CHAT_MODEL=deepseek:deepseek-flash JUDGE_MODEL=deepseek:deepseek-flash uv run python evals/run_evals.py` | `../.github/workflows/module10-evals.yml` |
| Metrics from traces | `uv run python metrics.py` (`--days 1`, `--alert`) | [metrics.py](metrics.py) |
| Dashboard | sidebar → **dashboard** (login required) | [pages/dashboard.py](pages/dashboard.py) |
| Hourly alert → Discord | secret `DISCORD_WEBHOOK_URL` (optional) | `../.github/workflows/module10-alert.yml` |
| Trace tags + PII redaction | every agent call uses `run_config()` | [backend.py](backend.py), [redact.py](redact.py) |
| Recipient allowlist | `EMAIL_ALLOWLIST=me@x.com,example.com` (empty = allow all while sending is simulated) | [tools.py](tools.py) |
| Light tests (no keys) | `uv run python test_auth.py`, then `test_redact.py`, `test_metrics.py` | `test_*.py` |

## Deploying

Render: New → Web Service → connect repo → it detects the `Dockerfile` (which serves the Streamlit app; set the health check path to `/_stcore/health`). Set `GROQ_API_KEY` and `TAVILY_API_KEY` as environment variables in the dashboard, never in the image.

**Persistence (v2 Phase 1):** set `DATABASE_URL` to a Neon **pooled** connection string and threads live in Postgres, so they survive redeploys and sleep. Without it the app falls back to `chatbot.db`, which the free-tier disk wipes.

## Done-means checklist

- [x] `/chat` streams tokens and remembers context per `thread_id`
- [x] Two different `thread_id`s never see each other's history
- [x] Math goes through `calculator`, not mental arithmetic
- [x] PDF questions cite page numbers
- [x] Email pauses, `/pending` shows the draft, `/approve` with `edited_body` changes what sends
- [x] Deployed to Render (Streamlit app, `/_stcore/health` green): https://agentic-chat-pwvx.onrender.com
- [x] LangSmith traces for 5 real conversations (calculator, web, PDF, memory, email-approval — project `agentic-ai-course`)
