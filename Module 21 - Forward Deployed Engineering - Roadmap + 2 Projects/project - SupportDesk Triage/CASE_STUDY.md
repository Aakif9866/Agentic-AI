# Case study: SupportDesk Triage for Brewly

FDE project 2 of Module 21. The first case study ([../fde-case-study.md](../fde-case-study.md)) looked back at a project I'd already built. This one starts from a customer problem and runs the full loop: scope → eval set → build → deploy → measure → iterate.

> Brewly is a **fictional** coffee-subscription startup. The customer voice in §1 is hypothetical; every number in §6 is real and reproducible from [`evals/`](evals/).

**Live:** https://supportdesk-triage.vercel.app (demo page; `POST /triage` for the API; limited to 20 tickets/hour/IP)

---

## 1. Customer problem

> *"There are two of us on support and we get about 150 tickets a day. Most of them are the same ten questions: password resets, 'where's my box', double charges. We copy-paste the same help article twenty times a day. But last month one of us pasted the 'charged twice' article into a ticket from someone threatening a chargeback, and it blew up into a Twitter thread. I don't want a robot talking to angry people or anyone asking for money. I just want the boring ones off my plate."* (Priya, head of support, Brewly)

What hurts: the **volume** of repetitive tickets, plus the **cost of a single wrong automated reply**. She asked for two things, and the second one is a safety constraint, not a feature.

## 2. Scoped spec

**v1 will:**

1. Label every ticket: category, priority, sentiment, and whether it's a refund or legal matter.
2. Decide escalation with **rules in code**, not by asking the model. The rules are Priya's own words: refund or legal matter, angry customer, urgent, or no category fits → a human handles it.
3. For everything else, pick one help-centre article and draft a reply that uses **only** that article and cites it.
4. Check the draft in code (no refund, credit or guarantee language the article doesn't contain, and the citation is present). If the check fails, escalate.

**v1 won't, and why:**

| Not building | Why the line is here |
|---|---|
| Sending replies automatically | Priya reviews drafts at first. Trust gets earned on real traffic before anything is sent without a human. |
| Vector search | 10 help articles. Keyword overlap scores 14/14 on routine tickets (§6). Embeddings would add a ~1 GB torch dependency and gain nothing measurable. Revisit at ~100 articles. |
| Letting the LLM decide escalation | The before/after in §6 shows why: the model's own judgement let an unsafe ticket through on both eval sets. |
| Multi-turn conversations | Tickets arrive one at a time. Threading is the helpdesk's job, not ours. |
| Helpdesk integration (Zendesk, etc.) | One HTTP endpoint is integrable from anywhere. Choosing a vendor is Priya's call, not a v1 blocker. |
| Retry/self-correction loops | Two LLM calls per ticket, no loops. A failed draft goes to a human, which is cheaper and safer than a second attempt. |
| Languages other than English | No evidence non-English tickets exist yet. |

## 3. Eval set

What "working" means, ordered by what the customer cares about:

1. **Unsafe auto-replies = 0.** A ticket that must reach a human gets an automated draft. This is the Twitter-thread metric. The target is zero, not "low".
2. **Escalation recall**: of the tickets that must escalate, how many did.
3. **Needless escalations**: routine tickets bounced to a human. These cost Priya time, which is why the product exists.
4. **Correct article** on auto-replies.

Two sets:

- [`evals/tickets.jsonl`](evals/tickets.jsonl): **24 tickets** (14 routine, 10 must-escalate), with deliberate traps: a *polite* refund request, a prompt injection asking the bot to approve a refund, an angry customer with an easy fix, a GDPR deletion, a sponsorship ask, a lawyer. **I tuned against this set.**
- [`evals/holdout.jsonl`](evals/holdout.jsonl): **8 fresh tickets** written after tuning was finished and run **once**. This is the honest number.

One classify call per ticket feeds both versions, so v0 vs v1 differs **only** in who decides escalation: v0 uses the model's own `should_escalate`, v1 uses the code policy.

## 4. Build

- [`triage.py`](triage.py): LangGraph, `classify → policy → find_article → draft → check`, at most 2 LLM calls per ticket.
- [`kb.py`](kb.py): 10 help articles + keyword retriever.
- [`test_triage.py`](test_triage.py): key-free checks of policy, retrieval and the draft guard. Runs in CI (`tests.yml`).
- [`api.py`](api.py): FastAPI + demo page + per-IP rate limit.
- Model: Groq `openai/gpt-oss-120b`, structured output via `json_mode` (repo pitfall #2). Swappable with `CHAT_MODEL`.

## 5. Deploy

**https://supportdesk-triage.vercel.app**: Vercel container ([`Dockerfile.vercel`](Dockerfile.vercel)), deployed from the terminal the same way as Module 10. Verified after deploy: `/health` 200, demo page 200, a refund ticket escalated, a password ticket answered from KB-03 (output in [NOTES.md](NOTES.md)).

## 6. Measure

All runs on `groq:openai/gpt-oss-120b`, 2026-11-28. Raw per-ticket output: `evals/results*.json` (regenerate with `uv run python evals/run_evals.py [holdout.jsonl]`).

**Round 1 → round 2 (tuning set, 24 tickets)**

| Metric | R1 v0 (LLM decides) | R1 v1 (code policy) | R2 v0 | **R2 v1** |
|---|---|---|---|---|
| Unsafe auto-replies | **1** | 0 | 0 | **0** |
| Escalation recall | 9/10 | 10/10 | 10/10 | **10/10** |
| Needless escalations | 1/14 | 3/14 | 2/14 | **0/14** |
| Correct article on auto-replies | — | 11/11 | — | **14/14** |
| Category accuracy | 22/24 | | 22/24 | |

What round 1 found, and what changed:

- **2 of v1's 3 needless escalations were a retrieval bug, not a model error.** The feature-request article is generic by design, so keyword overlap never reached the threshold. Fix: `feature_request` always maps to KB-10.
- That fix alone would have been **unsafe**: the model labelled a sponsorship ask (#21) as `feature_request`, which would then have earned an automated reply. So the prompt now defines `feature_request` narrowly and routes partnerships and sponsorships to `other`.
- **The third was an over-broad refund flag.** "I was charged twice" was flagged as a refund request. The prompt now says reporting a billing problem without asking for money back is `false`.

**Held-out (8 unseen tickets, run once, no tuning after)**

| Metric | v0 (LLM decides) | **v1 (code policy)** |
|---|---|---|
| Unsafe auto-replies | **1** (a job enquiry, #107) | **0** |
| Escalation recall | 3/4 | **4/4** |
| Needless escalations | 1/4 | **0/4** |
| Correct article on auto-replies | — | **4/4** |

**Read this honestly:**

- The model's labels were fine. Its *judgement about escalation* was what failed: it let an unsafe ticket through on both sets. Moving that decision into code is the single change that made the system safe, and it costs zero extra LLM calls.
- **Held-out #105 escalated for the wrong reason.** "Send a replacement box for free" was *not* flagged as refund/compensation. It escalated only because no shipping article matched. Retrieval was the safety net. With a luckier keyword match it would have drafted a reply, and the draft check wouldn't have saved it, because only "free month" is on the forbidden list, not "free". **This is the first v2 item:** add "replacement", "free" and "reship" to the compensation definition and the draft guard, then add 5 more compensation-phrased tickets to the eval set.
- 32 tickets is a small sample. 0/4 on held-out is consistent with a low error rate; it doesn't prove one. The real test is week one of Priya's traffic, where every escalation reason gets logged.

## What I'd do next with two more weeks

1. Fix the #105 gap (above), then re-run held-out on a **new** set, because this one has now been seen.
2. Shadow mode: run on real tickets for a week, with Priya marking each draft *sent as-is / edited / wrong*. "Sent as-is" rate is the metric that sells v2.
3. Log every escalation reason. If "no help article matches" dominates, the help centre is the bottleneck, not the agent, and the fix is writing articles, not code.
