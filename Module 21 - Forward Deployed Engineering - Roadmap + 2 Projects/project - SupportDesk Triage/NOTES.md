# NOTES: SupportDesk Triage (Module 21, FDE project)

The write-up is [CASE_STUDY.md](CASE_STUDY.md). These notes cover running it and what I learned.

## Run it

```bash
uv sync
env -u GROQ_API_KEY uv run python test_triage.py      # free, no key: policy, retrieval, draft guard
uv run python triage.py "I was charged twice"          # one ticket, 1-2 LLM calls
uv run python evals/run_evals.py                       # 24 tickets, ~38 calls, ~1-2 min
uv run python evals/run_evals.py holdout.jsonl         # 8 held-out tickets
uv run uvicorn api:app --reload                        # demo page at localhost:8000
```

Deploy (already done, from this folder):

```bash
npx vercel@67.0.0 link --yes --project supportdesk-triage
npx vercel@67.0.0 project update --framework container --yes
printf '%s' "$GROQ_API_KEY" | npx vercel@67.0.0 env add GROQ_API_KEY production
npx vercel@67.0.0 deploy --prod --yes
```

## The one idea

**The model labels; code decides.** The LLM says "this is billing, the customer is frustrated, they're asking for a refund". A plain Python `policy()` turns that into *escalate or not*. Why it matters:

- You can unit-test it (`test_triage.py`, no API key).
- The customer can read it. Priya can audit five lines; she can't audit a prompt.
- On the evals, the model's own `should_escalate` let one unsafe ticket through on **both** sets. The code policy let through zero. Same LLM call, different decider.

## Verified (real output, 2026-11-28)

```
tuning set R1  v0 unsafe=1 recall 9/10 needless 1/14 | v1 unsafe=0 recall 10/10 needless 3/14 | articles 11/11
tuning set R2  v0 unsafe=0 recall 10/10 needless 2/14 | v1 unsafe=0 recall 10/10 needless 0/14 | articles 14/14
held-out (1x)  v0 unsafe=1 recall 3/4  needless 1/4  | v1 unsafe=0 recall 4/4  needless 0/4  | articles 4/4

https://supportdesk-triage.vercel.app/health -> {"ok":true} [200]
POST /triage "I want a refund, the beans arrived stale"
  -> escalate: true, reasons: ["refund or legal request"]
POST /triage "I forgot my password and the reset email never arrives"
  -> escalate: false, article KB-03, draft ends "Source: [KB-03]"
```

## Gotchas hit

- **A fix that improves one metric can break another.** Mapping every `feature_request` to KB-10 fixed 2 needless escalations, but the model had labelled a sponsorship ask as `feature_request`, so that ticket would have been auto-answered. Always re-run the *whole* eval after a fix, not just the cases it targets.
- **The model's labels are looser than your definitions.** "I was charged twice" became `refund_or_legal: true`. The prompt has to say what is *not* included, not only what is.
- **Tuning on the eval set inflates the score.** R2 is perfect because I looked at R1's failures. The held-out set, written afterwards and run once, is the number to quote.
- **Groq's free tier is ~8k tokens/minute.** One run sat for 10 minutes with no output: `| tail` buffered everything while the client backed off on rate limits. Use `python -u` and a log file.
- Vercel needs `project update --framework container` or it ignores `Dockerfile.vercel` (same as Module 10).

## Not verified

- No real customer traffic. Every ticket is hand-written.
- Groq outage: no fallback provider is wired in. `CHAT_MODEL=deepseek:...` is wired (thinking disabled, as in Module 10) but **has never been run** here.
- The rate limit is per container, so a scaled-out deploy multiplies it.
