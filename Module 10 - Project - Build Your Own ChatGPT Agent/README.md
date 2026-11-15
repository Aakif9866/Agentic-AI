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
| Memory | LangGraph `SqliteSaver` → `chatbot.db` | `CHECKPOINT_DB` |
| Tracing | LangSmith (optional) | `LANGSMITH_*` |

## Abuse limits

| Limit | Default | Env var |
|---|---|---|
| Questions per visitor (IP) per rolling hour | 15 | `RATE_LIMIT_PER_HOUR` (0 closes the app) |
| Model calls per conversation | 12 | `MAX_LLM_CALLS_PER_THREAD` |
| Message length | 2000 chars | — |

The hourly limit lives in memory, so it resets on redeploy, and it only applies in the Streamlit app (not the JSON API). Each visitor's sidebar lists only their own chats; the thread id lives in the URL (`?t=...`), so a refresh keeps the conversation.

## Endpoints

| Method | Path | What it does |
|---|---|---|
| POST | `/chat` | Streams the reply token by token. Body: `{thread_id, message}` |
| GET | `/pending/{thread_id}` | The draft awaiting human approval, or `null` |
| POST | `/approve` | Resumes a paused thread. Body: `{thread_id, approved, edited_body?}` |
| GET | `/threads` | Every thread_id stored in `chatbot.db` |
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

## Deploying

Render: New → Web Service → connect repo → it detects the `Dockerfile` (which serves the Streamlit app; set the health check path to `/_stcore/health`). Set `GROQ_API_KEY` and `TAVILY_API_KEY` as environment variables in the dashboard, never in the image.

**Free-tier limitation:** the container's disk is wiped on redeploy and on sleep, so `chatbot.db` disappears and all threads are lost. For real persistence swap `SqliteSaver` for `PostgresSaver` (`langgraph-checkpoint-postgres`) against a free Neon/Supabase/Render Postgres. Same `compile(checkpointer=...)` call, different class.

## Done-means checklist

- [x] `/chat` streams tokens and remembers context per `thread_id`
- [x] Two different `thread_id`s never see each other's history
- [x] Math goes through `calculator`, not mental arithmetic
- [x] PDF questions cite page numbers
- [x] Email pauses, `/pending` shows the draft, `/approve` with `edited_body` changes what sends
- [ ] Deployed to Render, `/health` green on the public URL
- [x] LangSmith traces for 5 real conversations (calculator, web, PDF, memory, email-approval — project `agentic-ai-course`)
