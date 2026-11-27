# Changelog

What changed between the last v1 deployment and v2. Real output for every claim is in [NOTES.md](NOTES.md) → "v2 evidence".

## v2 — 2026-11-27 · live at https://agentic-chat-sepia.vercel.app

Compared with **v1** (commit `398acb0`, 2026-11-15, Render free tier, https://agentic-chat-pwvx.onrender.com, now retired).

### What you see in the app

| v1 (Render) | v2 (Vercel) |
|---|---|
| Anyone with the link could use it | **Sign-in page.** One username/password from env vars; nobody gets in if they're unset |
| Chats wiped on every redeploy or sleep | **Chats in Neon Postgres**, so they survive redeploys |
| Sidebar listed only this browser session's chats | Sidebar lists **all chats**, newest first |
| No way to remove a chat | **"Delete this chat"** button |
| No feedback | **👍/👎** under the latest answer, saved to its LangSmith trace |
| No numbers | **Dashboard** page: latency, cost per conversation, tool error rate, budget-cap hits |
| 512 MB RAM (Render free) | 2 GB (Vercel Hobby container) |

### How the agent behaves

- **Searches the PDF for "my notes / my document" questions.** v1 sometimes answered those from general knowledge.
- **At most 2 web searches per question, enforced in code.** v1 was seen making up to 7. At the cap, the model answers from the results it has.
- **States only what tool results say**, and says when they aren't enough.
- **Survives invented tool arguments.** If the model sends an invalid argument (e.g. Tavily `topic="weather"`), Groq rejects the call; v1 crashed the chat, v2 feeds the error back and retries once.
- **Resists prompt injection.** Text in documents, search results or pasted content is treated as data, never instructions. 10/10 adversarial cases blocked. Optional `EMAIL_ALLOWLIST` blocks unknown recipients in code.
- The greeting mentions that emails need approval.

### API

- `POST /login` returns a signed token (24 h). Every route except `/login` and `/health` needs `Authorization: Bearer <token>`.
- **Removed** `GET /threads`, which listed every conversation to anyone.
- **Added** `DELETE /threads/{id}`.

### Observability

- Every agent run is tagged: thread, model, app version, phase (`chat` / `approval`).
- Emails and phone numbers are replaced with `[REDACTED]` in every trace span before upload.
- [metrics.py](metrics.py): per-day p50/p95 latency, tokens, cost per conversation, success rate per tool, budget-cap hits.
- Hourly alert workflow (tool error rate > 10% or p95 > 15 s → Discord webhook). Verified by breaking the Tavily key on purpose, which also exposed a blind spot: tools that *return* errors were being counted as successes. Fixed.

### Quality gates

- 40-case eval suite ([evals/](evals/)) as LangSmith experiments: tool selection, LLM-as-judge answer quality, cost per case, 10 injection cases.
- Runs on DeepSeek V4.1-Flash (about a cent per run). Baseline: **95%** tool accuracy, **90%** answers, **10/10** injections blocked, 0 errors.
- PR gate fails on a > 5-point tool-accuracy drop, or on any case that errored. Proven locally: a "don't use tools" prompt scored 72.5% and failed.
- New light tests in CI: `test_auth.py`, `test_redact.py`, `test_metrics.py`.

### Infrastructure

- Checkpointer: `SqliteSaver` → `PostgresSaver` on Neon (SQLite stays as the local/CI fallback).
- Hosting: Render → Vercel container ([Dockerfile.vercel](Dockerfile.vercel)), deployed from the terminal.

### Unchanged

Calculator, Tavily web search, PDF search (FAISS + MiniLM), email with human approval, the 12-model-call budget per chat, 15 questions per hour, the Klyro "Spectrum" look, and the default model (free Groq `openai/gpt-oss-120b`).

### Not done yet

- **Emails are still simulated.** They pause for approval, but real Gmail sending (Phase 3b) is parked until a Google OAuth client exists.
- GitHub secrets for the PR eval workflow (`DEEPSEEK_API_KEY`, `TAVILY_API_KEY`, `LANGSMITH_API_KEY`).
- Optional: Discord webhook, LangSmith saved filters + online judge rule.

## v1 — 2026-11-15

Capstone of Modules 6–9: LangGraph agent with memory and threads, streaming, calculator / web search / PDF RAG / email-with-approval tools, per-thread budget cap, per-visitor rate limit, Klyro-styled Streamlit UI, FastAPI, Docker, Render deploy, LangSmith tracing.
