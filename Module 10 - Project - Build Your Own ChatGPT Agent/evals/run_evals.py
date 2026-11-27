"""Offline eval suite for the Module 10 agent, run as a LangSmith experiment.

    uv run python evals/run_evals.py                    # full suite, gate vs baseline
    uv run python evals/run_evals.py --quick 8          # first 8 cases
    uv run python evals/run_evals.py --update-baseline  # after merging to main

Scores per case:
  tool_selection  1/0: the set of tools called == expect_tools
  answer          1/0: expect_any substring / right email recipient / LLM-as-judge
                  faithfulness (vs `reference`, or grounded in the tool outputs)
  cost_usd        tokens x metrics.PRICES (agent calls only, not the judge)

Exits 1 if tool-selection accuracy is more than --max-drop below evals/baseline.json,
so CI blocks the PR. Email cases stop at the approval interrupt and are never
resumed, so no email is ever sent.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import uuid
from pathlib import Path
from typing import Literal

# Evals must not touch the real chat DB: in-memory SQLite, never Neon.
# Empty string (not unset) so backend's load_dotenv() can't fill it back in.
os.environ["DATABASE_URL"] = ""
os.environ["CHECKPOINT_DB"] = ":memory:"

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

from langchain.chat_models import init_chat_model  # noqa: E402
from langsmith import Client, evaluate  # noqa: E402
from pydantic import BaseModel  # noqa: E402

from backend import CHAT_MODEL, agent  # noqa: E402
from metrics import cost_usd  # noqa: E402

DATASET = HERE / "dataset.jsonl"
BASELINE = HERE / "baseline.json"


# ----------------------------------------------------------------- judge
class Verdict(BaseModel):
    verdict: Literal["pass", "fail"]
    reason: str


# A different model from the agent on purpose: Groq rate limits are per model, so the
# judge gets its own token quota instead of 429-ing against the agent's.
_judge = init_chat_model(
    "groq:openai/gpt-oss-20b", temperature=0, timeout=60, max_retries=2
).with_structured_output(Verdict, method="json_mode")  # Groq: json_mode + shape hint


def judge(question: str, answer: str, evidence: str, mode: str) -> Verdict | None:
    """None when the judge itself keeps failing (rate limit/timeout): that's an infra
    problem, not a wrong answer, so it's left out of the average instead of scored 0."""
    rule = (
        "PASS only if the answer agrees with the REFERENCE and adds nothing that contradicts it."
        if mode == "reference"
        else "PASS only if every factual claim in the answer is supported by the TOOL OUTPUTS."
    )
    prompt = (
        "You grade an AI assistant's answer. Be strict but fair. "
        'Respond with JSON of the exact form {"verdict": "pass"|"fail", "reason": str}.\n'
        f"{rule}\n\nQUESTION: {question}\n\n"
        f"{'REFERENCE' if mode == 'reference' else 'TOOL OUTPUTS'}: {evidence[:4000]}\n\n"
        f"ANSWER: {answer[:3000]}"
    )
    for attempt in range(4):
        try:
            return _judge.invoke(prompt)
        except Exception as e:
            print(f"  judge retry {attempt + 1}: {str(e)[:80]}")
            time.sleep(15 * (attempt + 1))
    return None


# ----------------------------------------------------------------- target
def run_agent(inputs: dict) -> dict:
    """One fresh thread per case. Captures what the evaluators need."""
    cfg = {"configurable": {"thread_id": f"eval-{uuid.uuid4()}"}, "recursion_limit": 25}
    for attempt in range(4):
        try:
            res = agent.invoke({"messages": [("user", inputs["question"])]}, cfg)
            break
        except Exception as e:  # free-tier 429s: back off and retry
            if attempt < 3 and ("429" in str(e) or "rate" in str(e).lower()):
                time.sleep(10 * (attempt + 1))
                continue
            return {"answer": f"ERROR: {str(e)[:300]}", "tools": [], "email_to": None,
                    "tool_outputs": "", "interrupted": False, "cost_usd": 0.0}

    msgs = res["messages"]
    calls = [c for m in msgs for c in (getattr(m, "tool_calls", None) or [])]
    usage = [m.usage_metadata for m in msgs if getattr(m, "usage_metadata", None)]
    return {
        "answer": str(msgs[-1].content) if msgs[-1].type == "ai" else "",
        "tools": [c["name"] for c in calls],
        "email_to": next((c["args"].get("to") for c in calls if c["name"] == "send_email"), None),
        "tool_outputs": "\n\n".join(str(m.content) for m in msgs if m.type == "tool"),
        "interrupted": "__interrupt__" in res,
        "cost_usd": cost_usd(sum(u["input_tokens"] for u in usage),
                             sum(u["output_tokens"] for u in usage)),
    }


# ----------------------------------------------------------------- evaluators
def tool_selection(outputs: dict, reference_outputs: dict) -> dict:
    return {"key": "tool_selection",
            "score": int(set(outputs["tools"]) == set(reference_outputs["expect_tools"]))}


def answer(inputs: dict, outputs: dict, reference_outputs: dict) -> dict:
    ref = reference_outputs
    if "expect_to" in ref:  # email: right recipient, and it paused for approval
        ok = outputs["interrupted"] and (outputs["email_to"] or "").lower() == ref["expect_to"]
        return {"key": "answer", "score": int(ok), "comment": f"to={outputs['email_to']}"}
    if "expect_any" in ref:
        low = outputs["answer"].lower().replace(",", "")
        ok = any(s.lower().replace(",", "") in low for s in ref["expect_any"])
        return {"key": "answer", "score": int(ok)}
    if not outputs["answer"] or outputs["answer"].startswith("ERROR"):
        return {"key": "answer", "score": 0, "comment": outputs["answer"][:200]}
    mode = "reference" if "reference" in ref else "tools"
    evidence = ref["reference"] if mode == "reference" else outputs["tool_outputs"]
    if mode == "tools" and not evidence:
        return {"key": "answer", "score": 0, "comment": "no tool output to ground on"}
    v = judge(inputs["question"], outputs["answer"], evidence, mode)
    if v is None:
        return {"key": "answer", "score": None, "comment": "judge unavailable"}
    return {"key": "answer", "score": int(v.verdict == "pass"), "comment": v.reason}


def cost(outputs: dict) -> dict:
    return {"key": "cost_usd", "score": outputs["cost_usd"]}


# ----------------------------------------------------------------- dataset sync
def sync_dataset(client: Client, cases: list[dict]) -> str:
    """Dataset name carries a hash of the jsonl, so editing it creates a fresh dataset
    and old experiments stay comparable against the exact cases they ran on."""
    name = f"module10-evals-{hashlib.sha256(DATASET.read_bytes()).hexdigest()[:8]}"
    if not client.has_dataset(dataset_name=name):
        ds = client.create_dataset(name, description="Module 10 agent offline evals")
        client.create_examples(dataset_id=ds.id, examples=[
            {"inputs": {"question": c["question"]},
             "outputs": {k: v for k, v in c.items() if k != "question"}}
            for c in cases
        ])
    return name


# ----------------------------------------------------------------- main
def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", type=int, default=0, help="only the first N cases")
    ap.add_argument("--max-drop", type=float, default=0.05, help="allowed accuracy drop vs baseline")
    ap.add_argument("--update-baseline", action="store_true")
    ap.add_argument("--prefix", default="module10", help="LangSmith experiment name prefix")
    args = ap.parse_args()

    cases = [json.loads(line) for line in DATASET.read_text().splitlines() if line.strip()]
    client = Client()
    name = sync_dataset(client, cases)
    order = {c["id"]: i for i, c in enumerate(cases)}
    examples = sorted(client.list_examples(dataset_name=name), key=lambda e: order[e.outputs["id"]])
    if args.quick:
        examples = examples[: args.quick]

    results = evaluate(
        run_agent,
        data=examples,
        evaluators=[tool_selection, answer, cost],
        experiment_prefix=args.prefix,
        metadata={"model": CHAT_MODEL, "git_sha": os.getenv("GITHUB_SHA", "local")},
        max_concurrency=1,  # free-tier rate limits
    )

    rows = []
    for r in results:
        s = {e.key: e.score for e in r["evaluation_results"]["results"]}
        ref = r["example"].outputs
        rows.append({"id": ref["id"], "category": ref["category"], **s,
                     "tools": ",".join(r["run"].outputs["tools"]) if r["run"].outputs else "?"})
    rows.sort(key=lambda x: order[x["id"]])

    print(f"\n{'id':<8}{'category':<12}{'tools':>6}{'answer':>8}{'cost $':>10}  tools called")
    show = lambda v: "-" if v is None else v  # noqa: E731
    for x in rows:
        print(f"{x['id']:<8}{x['category']:<12}{show(x.get('tool_selection')):>6}"
              f"{show(x.get('answer')):>8}{x.get('cost_usd') or 0:>10.5f}  {x['tools']}")

    n = len(rows)
    judged = [x["answer"] for x in rows if x.get("answer") is not None]
    summary = {
        "cases": n,
        "tool_selection": round(sum(x.get("tool_selection") or 0 for x in rows) / n, 3),
        "answer": round(sum(judged) / max(len(judged), 1), 3),
        "answer_scored": len(judged),
        "cost_per_case_usd": round(sum(x.get("cost_usd") or 0 for x in rows) / n, 6),
        "model": CHAT_MODEL,
    }
    print(f"\nSUMMARY {json.dumps(summary)}")
    print(f"experiment: {results.experiment_name}")

    if args.update_baseline:
        if args.quick:
            print("refusing to write a baseline from a --quick run")
            return 1
        BASELINE.write_text(json.dumps(summary, indent=2) + "\n")
        print(f"baseline written to {BASELINE.name}")
        return 0

    if not BASELINE.exists():
        print("no baseline.json yet; run with --update-baseline on main")
        return 0
    base = json.loads(BASELINE.read_text())["tool_selection"]
    floor = base - args.max_drop
    if summary["tool_selection"] < floor:
        print(f"FAIL: tool accuracy {summary['tool_selection']:.1%} < baseline "
              f"{base:.1%} - {args.max_drop:.0%} = {floor:.1%}")
        return 1
    print(f"PASS: tool accuracy {summary['tool_selection']:.1%} >= floor {floor:.1%}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
