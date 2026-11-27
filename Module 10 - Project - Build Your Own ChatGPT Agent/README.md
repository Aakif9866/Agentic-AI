# Module 10 — ChatGPT-style Agent (capstone for Modules 6–9)

Everything from Modules 6–9 in one agent: memory, streaming, threads, tools, RAG, and human approval. The app is a Streamlit UI (Klyro "Spectrum" theme); a FastAPI service exposes the same agent as JSON.

**Live: https://agentic-chat-sepia.vercel.app** (sign-in required). **v2** added a login, Postgres persistence, tracing with PII redaction, metrics and alerts, a 40-case eval gate and prompt-injection defences. What changed and why: [CHANGELOG.md](CHANGELOG.md). Beginner walkthrough: [HOW_IT_WORKS.md](HOW_IT_WORKS.md). Design: [ARCHITECTURE.md](ARCHITECTURE.md).

## Run it

```bash
uv sync
uv run python ingest.py sample_notes.pdf      # fills faiss_db/ for the search_docs tool
uv run streamlit run ui_streamlit.py          # the app, on :8501 (this is what Docker serves)
uv run uvicorn api:app --reload               # optional JSON API on :8000
uv run python test_rate_limit.py              # limiter self-check
uv run python test_auth.py                    # login/token checks (also test_redact.py, test_metrics.py)
```

Needs `GROQ_API_KEY` and `TAVILY_API_KEY` in `.env`, plus `APP_USERNAME`, `APP_PASSWORD` and `APP_SECRET` to log in. `DATABASE_URL` (Neon) is optional locally; without it chats go to `chatbot.db`.

## What it runs on

| Piece | Service | Configured by |
|---|---|---|
| LLM | Groq, `openai/gpt-oss-120b` (free tier) | `CHAT_MODEL` (e.g. `openai:gpt-4o-mini`) |
| Web search | Tavily | `TAVILY_API_KEY` |
| PDF search | FAISS + `all-MiniLM-L6-v2`, runs locally, no API | `EMBED_MODEL` |
| Memory | LangGraph `PostgresSaver` on Neon when `DATABASE_URL` is set, else `SqliteSaver` → `chatbot.db` | `DATABASE_URL`, `CHECKPOINT_DB` |
| Login | one username/password, HMAC-signed API tokens ([auth.py](auth.py)) | `APP_USERNAME`, `APP_PASSWORD`, `APP_SECRET` |
| Tracing | LangSmith (optional), PII-redacted, tagged per run | `LANGSMITH_*`, `APP_VERSION` |
| Evals | DeepSeek V4.1-Flash for agent + judge (cheap, no daily cap) | `CHAT_MODEL`, `JUDGE_MODEL`, `DEEPSEEK_API_KEY` |
| Hosting | Vercel container ([Dockerfile.vercel](Dockerfile.vercel)) | Vercel project env vars |

## Abuse limits

| Limit | Default | Env var |
|---|---|---|
| Questions per visitor (IP) per rolling hour | 15 | `RATE_LIMIT_PER_HOUR` (0 closes the app) |
| Model calls per conversation | 12 | `MAX_LLM_CALLS_PER_THREAD` |
| Web searches per question (enforced in code) | 2 | `MAX_SEARCHES_PER_TURN` |
| Email recipients | anyone (sending is simulated) | `EMAIL_ALLOWLIST` (addresses or domains) |
| Message length | 2000 chars | — |

The hourly limit lives in memory, so it resets on redeploy, and it only applies in the Streamlit app (not the JSON API). **Login (v2 Phase 3):** the app and the API sit behind one username/password from env vars (`APP_USERNAME`, `APP_PASSWORD`, `APP_SECRET`; see [auth.py](auth.py)). If any is unset, nobody can log in. After login the sidebar lists every chat; the thread id lives in the URL (`?t=...`), so a refresh keeps the conversation.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/login` | `{username, password}` → `{token}` (valid 24 h). Every route below except `/health` needs `Authorization: Bearer <token>`, else 401 |
| POST | `/chat` | Streams the reply token by token. Body: `{thread_id, message}` |
| GET | `/pending/{thread_id}` | The draft awaiting human approval, or `null` |
| POST | `/approve` | Resumes a paused thread. Body: `{thread_id, approved, edited_body?}` |
| DELETE | `/threads/{thread_id}` | Deletes a conversation and all its checkpoints |
| GET | `/health` | `{"ok": true}` — no token needed; what hosts and CI poll |

## Tools the agent can call

- `calculator` — arithmetic, whitelisted expression (no bare `eval`)
- `tavily_search` — live web search
- `search_docs` — FAISS search over the ingested PDF, cites page numbers; output is wrapped in `<untrusted_document>` tags
- `send_email` — **pauses for human approval**, and the human can edit the body first. Sending is still **simulated** (real Gmail is v2 Phase 3b, parked); `EMAIL_ALLOWLIST` is checked before the approval card

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

**Live (v2): https://agentic-chat-sepia.vercel.app** — Vercel container deploy, from the terminal:

```bash
npx vercel@67.0.0 link --yes --project agentic-chat
npx vercel@67.0.0 project update --framework container --yes   # else Vercel builds nothing and serves 404
printf '%s' "$VALUE" | npx vercel@67.0.0 env add NAME production  # once per env var below
npx vercel@67.0.0 deploy --prod --yes -e APP_VERSION=$(git rev-parse --short HEAD)   # tags traces with the commit
```

Vercel builds [Dockerfile.vercel](Dockerfile.vercel) (same image as `Dockerfile`, port 80); [.vercelignore](.vercelignore) keeps `.env` and the 1.3 GB `.venv` out of the upload. Hobby limits to know: a connection lasts at most 5 minutes and idle containers scale to zero after 5 minutes, so expect a cold start (~torch + model load) and an occasional reconnect. Chats survive both (Neon + `?t=` in the URL).

**Old: Render** (v1, no longer maintained): New → Web Service → connect repo → it detects the `Dockerfile` (which serves the Streamlit app; set the health check path to `/_stcore/health`). Environment variables (dashboard only, never in the image): `GROQ_API_KEY`, `TAVILY_API_KEY`, `DATABASE_URL` (Neon pooled URL), `APP_USERNAME`, `APP_PASSWORD`, `APP_SECRET` (login; **without these three nobody can log in**). Optional: `LANGSMITH_TRACING=true` + `LANGSMITH_API_KEY` + `LANGSMITH_PROJECT`, `EMAIL_ALLOWLIST`. Set them **before** deploying v2.

**Persistence (v2 Phase 1):** set `DATABASE_URL` to a Neon **pooled** connection string and threads live in Postgres, so they survive redeploys and sleep. Without it the app falls back to `chatbot.db`, which the free-tier disk wipes.

## Done-means checklist

- [x] `/chat` streams tokens and remembers context per `thread_id`
- [x] Two different `thread_id`s never see each other's history
- [x] Math goes through `calculator`, not mental arithmetic
- [x] PDF questions cite page numbers
- [x] Email pauses, `/pending` shows the draft, `/approve` with `edited_body` changes what sends
- [x] Deployed to Render (Streamlit app, `/_stcore/health` green): https://agentic-chat-pwvx.onrender.com (v1, superseded by Vercel below)
- [x] LangSmith traces for 5 real conversations (calculator, web, PDF, memory, email-approval — project `agentic-ai-course`)

**v2** (details and real output: [NOTES.md](NOTES.md) → "v2 evidence", status: [V2_SCOPE.md](V2_SCOPE.md))
- [x] Chats in Postgres (Neon); a fresh process restores them
- [x] Deployed to Vercel: https://agentic-chat-sepia.vercel.app (health 200, WebSocket 101, Sign-in form renders with no exceptions) · [ ] a chat survives a redeploy
- [x] Login + API token; no token → 401; `/threads` removed; chats can be deleted
- [x] 40-case eval suite: 95% tools, 90% answers, 10/10 injections blocked; a broken prompt fails the gate (exit 1)
- [x] Every trace tagged and PII-redacted; `metrics.py` + dashboard; alert fired with a deliberately bad Tavily key
- [ ] Real Gmail sending (Phase 3b, parked: needs a Google OAuth client)
