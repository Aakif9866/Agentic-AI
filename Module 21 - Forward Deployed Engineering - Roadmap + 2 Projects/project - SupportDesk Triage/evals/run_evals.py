"""Score v0 (the LLM decides escalation) against v1 (code policy) on the same classify call.

    uv run python evals/run_evals.py          # ~38 LLM calls, Groq free tier
    CHAT_MODEL=deepseek:deepseek-chat uv run python evals/run_evals.py

One classify call per ticket feeds both versions, so the before/after differs only
in who decides escalation. Any exception aborts the run: a crashed case scored as a
fail is how a fake baseline happened in Module 10 (repo MEMORY.md, pitfall 8).
"""
import json
import pathlib
import sys
import time

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent))
from triage import MODEL, triage  # noqa: E402

HERE = pathlib.Path(__file__).parent
cases = [json.loads(line) for line in (HERE / (sys.argv[1] if len(sys.argv) > 1 else "tickets.jsonl")).read_text().splitlines()]
rows, t0 = [], time.time()
for c in cases:
    out = triage(c["ticket"])
    rows.append({"id": c["id"], "expected": c, "category": out["triage"]["category"],
                 "v0_escalate": out["triage"]["should_escalate"], "v1_escalate": out["escalate"],
                 "reasons": out["reasons"], "article_id": out["article_id"], "draft": out["draft"]})
    print(f"#{c['id']:>2} cat={rows[-1]['category']:<16} v0={'ESC' if rows[-1]['v0_escalate'] else 'auto'} "
          f"v1={'ESC' if out['escalate'] else 'auto'} {out['reasons'] or out['article_id']}")

must = [r for r in rows if r["expected"]["must_escalate"]]
routine = [r for r in rows if not r["expected"]["must_escalate"]]


def score(v):
    return {"unsafe_auto_replies": sum(not r[v] for r in must),
            "escalation_recall": f"{sum(r[v] for r in must)}/{len(must)}",
            "needless_escalations": f"{sum(r[v] for r in routine)}/{len(routine)}"}


summary = {
    "model": MODEL, "cases": len(rows), "seconds": round(time.time() - t0),
    "category_accuracy": f"{sum(r['category'] == r['expected']['category'] for r in rows)}/{len(rows)}",
    "v0_llm_decides": score("v0_escalate"),
    "v1_code_policy": score("v1_escalate"),
    "v1_correct_article_on_auto_replies": f"{sum(r['article_id'] == r['expected']['article'] for r in routine if not r['v1_escalate'])}"
                                          f"/{sum(not r['v1_escalate'] for r in routine)}",
}
print(json.dumps(summary, indent=2))
(HERE / ("results_" + pathlib.Path(sys.argv[1]).stem + ".json" if len(sys.argv) > 1 else "results.json")).write_text(json.dumps({"summary": summary, "rows": rows}, indent=2))
