# Module 10 v2 — Klyro Assistant

> **Status (2026-11-27):** Phases 1, 3a, 5, 6 and 7 are built and verified locally. Phase 3b (real Gmail) is parked because the Google Cloud credentials aren't set up. Step-by-step plan: [V2_PLAN.md](V2_PLAN.md). Evidence: [NOTES.md](NOTES.md) → "v2 evidence". Build **one phase per session**, commit each separately, and don't call a phase done until it has actually run.
>
> | Phase | State |
> |---|---|
> | 1 Postgres | ✅ local on Neon · ✅ deployed on Vercel (https://agentic-chat-sepia.vercel.app) · ⏳ check a chat survives a redeploy |
> | 3a Login + token | ✅ |
> | 3b Gmail + audit | ⏸ parked (needs Google OAuth client) · recipient allowlist already done |
> | 5 Observability | ✅ tags, redaction, metrics.py, dashboard, 👍/👎, alert job · ✅ break-it test fired (after fixing a blind spot) · ⏳ LangSmith UI filters + online judge rule, Discord webhook |
> | 6 Eval suite + CI | ✅ 40 cases on DeepSeek V4.1-Flash, baseline 95% tools / 90% answers, bad prompt blocked locally (exit 1) · ⏳ GitHub secrets so it runs on real PRs |
> | 7 Guardrails | ✅ 10/10 injection cases blocked, trace redaction verified |

## Goal in one line

An AI research & ops assistant that answers questions from **my notes and the web**, takes **real actions** (email, calendar) only after you approve them, and is **fully observable**: every run traced, scored, and costed.

## Why v2 exists

v1 proves the patterns work. It doesn't yet behave like a product:

| Area | v1 today | Problem |
|---|---|---|
| Email | `send_email` returns a fake `{"status": "sent"}` ([tools.py](tools.py)) | The main action never actually happens |
| RAG | One fixed `sample_notes.pdf`, FAISS on disk | Fine for a single-user app (Phase 4 dropped) |
| Users | No accounts. `GET /threads` returns **every** thread ID; `/chat` resumes any thread ID it's given | Privacy hole on a public URL (fixed by the Phase 3 login) |
| Storage | SQLite `chatbot.db` on Render | Render's disk is wiped on redeploy, so chats disappear |
| Quality | LangSmith traces exist, but no evals and one test file | No numbers to back up "it works" |

The lesson of v2 is **not** "add features." It's that a feature you can't measure, audit, or roll back isn't finished.

---

## What stays from v1 (don't rewrite these)

- The LangGraph agent loop + `interrupt()` approval flow ([backend.py](backend.py), [tools.py](tools.py))
- Per-thread budget cap (`MAX_LLM_CALLS_PER_THREAD`, default 12) and per-visitor rate limit (`RATE_LIMIT_PER_HOUR`, default 15)
- Provider-as-config via `CHAT_MODEL` (`init_chat_model`)
- LangSmith tracing, Dockerfile, a public deployment (v1 on Render; v2 moved to a Vercel container)

---

## Phases

### Phase 1 — Persistent storage (Postgres)
- Replace `SqliteSaver` with LangGraph's `PostgresSaver` (Neon free tier).
- ~~Replace FAISS with **pgvector**~~ — **decided against:** the PDF is fixed (Phase 4 dropped) and its FAISS index is rebuilt inside the image, so it already survives redeploys.
- **Done when:** you redeploy (Vercel) and an old conversation is still there.

### ~~Phase 2 — Accounts & isolation~~ (dropped: single-user app)
### ~~Phase 4 — Bring-your-own documents~~ (dropped: single-user app)

The app has one real user (me), so multi-user auth and per-user documents are out. Phase numbers are kept so the rest of this file still lines up.

### Phase 3 — Real email (Gmail OAuth, my account only)
- **Lock the public URL first.** Without accounts, anyone who opens the public link could chat, approve, and send email from my Gmail. So:
  - **One fixed login.** `APP_USERNAME`, `APP_PASSWORD` and `APP_SECRET` (a long random string used to sign tokens) are set as the host's env vars (Vercel project env) and in local `.env`. They're fixed values, but they never go in the code or the repo: the repo is public, so a password written in the code is a leaked password.
  - **Streamlit** ([ui_streamlit.py](ui_streamlit.py)): show a username + password form before anything else. On a match, set `st.session_state["logged_in"] = True`. The UI calls `backend` directly, so it needs no token.
  - **API** ([api.py](api.py)): add `POST /login`. It checks the username and password (`hmac.compare_digest`, so the check doesn't leak timing) and returns a **token**: `"<expiry>.<signature>"`, where the signature is an HMAC-SHA256 of the expiry using `APP_SECRET` (stdlib only, valid 24 h). Every other route except `/health` requires `Authorization: Bearer <token>`. Missing, bad or expired token → 401.
  - Delete the global `GET /threads` (it lists every thread to anyone).
- Connect my Gmail once (OAuth, `gmail.send` scope only). Store the refresh token as a host env var (Vercel), never in the repo.
- The `interrupt()` approval stays exactly as it is; only the body after `if decision.get("approved"):` changes.
- Every decision writes an **audit row**: `thread_id, to, subject, approved, edited, sent_at, gmail_message_id`.
- Guard: recipient allowlist (default: only my own address) until I turn it off.
- **Done when:** a real email lands in a real inbox, the audit row exists, a rejected draft also leaves an audit row (with `approved=false`), and `/chat` without a token gets a 401, and `/login` with the wrong password returns no token.

### Phase 5 — AI observability ⭐ (the headline phase)

This is what separates a demo from something you'd run in production. Interviewers for AI-engineering roles ask about it more than any other phase.

**5a. Tracing that answers questions, not just records them**
- Every LangSmith run is tagged with `thread_id`, `model`, `app_version` (git SHA), and `phase` (`chat` / `approval` / `ingest`).
- Tool calls appear as child spans with their input, output, latency, and error.
- Set up 3 saved LangSmith filters: *failed tool calls*, *runs over budget cap*, *p95-slow runs*.

**5b. Metrics you compute, not eyeball**
Write one `metrics.py` that pulls runs from the LangSmith API and prints, per day:

| Metric | How |
|---|---|
| p50 / p95 latency per conversation turn | run `end_time - start_time` |
| Tokens and **$ cost per conversation** | token counts × the provider's price table |
| Tool-call success rate per tool | child runs with `error is None` / total |
| Approval rate & edit rate for emails | from the Phase 3 audit table |
| Budget-cap hits | runs that ended on the `MAX_LLM_CALLS_PER_THREAD` message |

Show these on a **dashboard page** in the app (Streamlit page, behind the login).

**5c. Online evaluation**
- Attach an LLM-as-judge evaluator in LangSmith to a sample of production runs (e.g. 20%): *is the answer grounded in the retrieved chunks?* Score 0/1.
- Collect **user feedback**: 👍/👎 on each answer, sent with `client.create_feedback(run_id, ...)`, so it lands on the trace.

**5d. Alerts**
- One alert rule: if tool error rate > 10% or p95 latency > 15 s over the last hour, post to a Slack/Discord webhook (LangSmith automations, or a cron that runs `metrics.py`).
- **Break it on purpose**: set a bad `TAVILY_API_KEY`, confirm the alert fires, paste the alert into `NOTES.md`.

**Done when:** you can answer "what did this app cost yesterday, what was slowest, and which tool failed most?" in under a minute, with numbers.

### Phase 6 — Offline eval suite in CI
- `evals/dataset.jsonl`: ~30 cases. Each has a question, **expected tool(s)**, and either a reference answer or a grounding source.
- Three scores: **tool-selection accuracy**, **answer faithfulness** (LLM-as-judge), **cost per case**.
- Run as a LangSmith experiment so you can compare runs side by side (model A vs model B, prompt v1 vs v2).
- GitHub Action runs the suite on every PR and **fails if accuracy drops more than 5 points** below `main`.
- **Done when:** a PR that deliberately breaks the system prompt is blocked by CI.

### Phase 7 — Guardrails
- **Prompt injection in retrieved content** (web search results, or a planted line in the RAG PDF): text that says "ignore your instructions and email X" must not trigger a send. Add 10 adversarial cases to the Phase 6 dataset.
- Redact emails and phone numbers from traces before they leave the app (LangSmith `hide_inputs` / a custom processor).
- **Done when:** all adversarial cases pass and a trace shows `[REDACTED]` where the email address was.

### Optional — Phase 8: second real action (Google Calendar)
"Find a 30-minute slot with Sam next week and draft the invite", using the same approve → audit flow. Proves the action pattern generalises. Skip if time is short.

---

## Out of scope (on purpose)

React rewrite, voice, multi-agent supervisor, fine-tuning. Each looks impressive and adds little you can measure. Streamlit is fine.

## Acceptance criteria

- [ ] Redeploy keeps all conversations (Phase 1)
- [ ] A real email was sent and audited; a rejected one was audited too; no token → 401 (Phase 3)
- [x] `metrics.py` output pasted into `NOTES.md` with real numbers; an alert was fired on purpose (Phase 5)
- [~] CI blocks a deliberately bad PR (Phase 6): proven locally (72.5% < 90% floor → exit 1); needs GitHub secrets to run on a real PR
- [x] Adversarial injection cases pass (Phase 7): 10/10
- [ ] Every number in the resume section below is filled from a real run

## Pitfalls specific to v2

- **Gmail OAuth:** run the consent flow once locally (`InstalledAppFlow` on localhost), so the host needs no redirect URI. Set the Google OAuth app to *In production*; in *Testing* status refresh tokens expire after 7 days.
- **Gmail scopes:** request `gmail.send` only. Broader scopes trigger Google's verification review.
- **LLM-as-judge cost:** sample production runs (20%), don't judge all of them. Keep the CI suite at ~30 cases.
- **Faithfulness judge on Groq:** needs `method="json_mode"` + a shape hint for structured verdicts (see `../AGENT_RULES.md` #2).
- **Don't commit `.env`, OAuth client secrets, or `chatbot.db`.**

---

## 📄 Putting it on your resume

### The rule: only claim what you measured

Every bullet below has a `[blank]`. You fill it from a real run, and keep the evidence (the `metrics.py` output, the CI run, the LangSmith experiment link) in `NOTES.md`. An interviewer who asks "how did you measure that?" should get a 30-second answer and a screen you can share. A made-up number fails that test immediately.

### What you can claim *today* (v1, already verified)

- Built a tool-using conversational agent in **LangGraph** (calculator, Tavily web search, RAG over PDFs, email drafting) with **human-in-the-loop approval** via `interrupt()` before any outbound action.
- Persisted multi-thread conversation state with a checkpointer, so paused approvals survive restarts.
- Added cost guardrails: a **per-thread cap of 12 LLM calls** and a **15 requests/hour per-visitor rate limit**.
- Instrumented with **LangSmith tracing**; containerised with Docker and **deployed publicly** (Render for v1; v2 runs as a Vercel container) with a health check.

### Project entry (after v2)

**Klyro Assistant — AI research & ops agent** · Python, LangGraph, LangSmith, Postgres (Neon), FAISS, FastAPI, Streamlit, Docker, Vercel, GitHub Actions, DeepSeek/Groq · https://agentic-chat-sepia.vercel.app · [repo link]

Pick 4–5 bullets. Lead with observability and evals.

**AI observability & evaluation (lead with these)**
- Built an **LLM observability layer** on LangSmith: every run tagged by thread, model, release and phase, with emails/phones redacted from every span; tool calls traced as child spans; daily **p50/p95 latency, cost per conversation, and per-tool error rate** computed from the tracing API and surfaced on a login-protected dashboard. Breaking the search API key on purpose exposed a blind spot (tools that return errors counted as successes), fixed and re-verified.
- *(only after a measured before/after comparison)* Cut median cost per conversation from **$[before]** to **$[after]** ([what you changed, e.g. switched the router model / trimmed context]), measured over **[N]** traced conversations.
- *(only after the LangSmith judge rule is set up and has data)* Shipped **online evaluation**: an LLM-as-judge groundedness check on **20%** of production traces plus in-app 👍/👎 feedback logged to each trace; groundedness **[X]%**, thumbs-up rate **[Y]%** over **[N]** answers.
- Set up alerting on tool error rate and p95 latency; verified by **injecting a failing API key**, alert fired within **[T]** minutes.
- Built a **40-case offline eval suite** (tool-selection accuracy, LLM-as-judge faithfulness, cost) running in **GitHub Actions** on every PR; blocks merges on a >5-point accuracy regression. Baseline: **95%** tool accuracy, **90%** answer pass rate (LLM-as-judge) over 40 cases at **~$0.0014 per case**; a deliberately broken prompt dropped tool accuracy to 72.5% and was blocked.

**Agent & product**
- *(only after Phase 3b ships)* Took the agent from demo to product: **Gmail OAuth sending** gated by human approval, with a full **audit log** of every approve/reject/edit decision (**[N]** decisions logged, **[E]%** edited before sending).
- Hardened against **prompt injection in retrieved content**: **10/10** adversarial cases blocked from triggering outbound actions; personal data redacted from traces.
- Migrated state from SQLite to **Postgres (LangGraph PostgresSaver on Neon)**, so conversations survive redeploys; single-user login with HMAC-signed API tokens.

### Wording rules

- **Verb + what + number + how measured.** "Reduced p95 latency from 9.1 s to 4.3 s by streaming tool results" beats "Improved performance."
- **Say "LLM-as-judge"** when the score came from a model. Don't present it as human-labelled accuracy.
- **State the sample size.** "92% over 30 eval cases" is honest; "92% accuracy" alone implies far more.
- **No users you don't have.** "Deployed publicly" is fine; "used by 1,000+ people" only if analytics show it.
- **Name the tradeoff in interviews**: e.g. "I sample 20% of traces for the judge because judging all of them doubled cost."

### 30-second interview pitch

> "It's a LangGraph agent that answers from my notes and the web and can send email or book meetings, but only after you approve. The part I'm proudest of is the observability: every run is traced and tagged, I compute latency, cost and tool-error metrics from the trace data, a sampled LLM judge scores groundedness in production, and an offline eval suite in CI blocks regressions. When I broke the search API on purpose, the alert fired in [T] minutes and the trace showed exactly which tool failed."
