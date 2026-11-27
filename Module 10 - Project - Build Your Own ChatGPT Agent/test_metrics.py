"""uv run python test_metrics.py  — metric maths on fake runs, no network."""
from datetime import datetime, timedelta
from types import SimpleNamespace as R

from metrics import cost_usd, summarize, tool_failed

t = datetime(2026, 11, 27, 12)


def root(thread, secs, pin, pout, out="ok"):
    return R(id=thread + str(secs), start_time=t, end_time=t + timedelta(seconds=secs),
             prompt_tokens=pin, completion_tokens=pout, total_tokens=pin + pout,
             outputs={"messages": [out]},
             extra={"metadata": {"thread_id": thread, "model": "groq:openai/gpt-oss-120b"}})


roots = [root("a", 1, 1000, 100), root("a", 3, 2000, 200), root("b", 20, 1_000_000, 0,
         out="This conversation has reached its budget of 12 model calls.")]
ok = {"output": {"content": "42"}}
tools = [R(name="calculator", error=None, outputs=ok), R(name="tavily_search", error="401", outputs=None),
         R(name="tavily_search", error=None, outputs=ok), R(name="calculator", error=None, outputs=ok)]

s = summarize(roots, tools)
assert s["turns"] == 3 and s["conversations"] == 2
assert s["p50_s"] == 3 and s["p95_s"] == 20
assert s["tool_error_rate"] == 0.25
assert s["tool_success"] == {"calculator": "2/2", "tavily_search": "1/2"}
assert s["budget_cap_hits"] == 1
assert abs(s["cost_usd"] - (cost_usd(3000, 300) + 0.15)) < 1e-9          # 1M input tokens = $0.15
assert summarize([], [])["tool_error_rate"] == 0.0                      # empty window is safe

# Errors the tool RETURNED instead of raising must count as failures too.
returned = lambda c: R(name="t", error=None, outputs={"output": {"content": c}})  # noqa: E731
assert tool_failed(returned("{'error': ValueError('Error 401: Unauthorized')}"))
assert tool_failed(returned("error: only numbers and + - * / % ( ) are allowed"))
assert not tool_failed(returned("{'status': 'blocked', 'error': 'not on allowlist'}"))  # guardrail, not outage
assert not tool_failed(returned("The error rate fell to 2% last year."))                # just mentions "error"
print("metrics OK")
