"""Numbers from the LangSmith traces, not eyeballed.

    uv run python metrics.py            # last 7 days, one row per day
    uv run python metrics.py --days 1
    uv run python metrics.py --alert    # last hour; posts to DISCORD_WEBHOOK_URL if bad

Only runs tagged "module10" count (backend.run_config adds the tag), because the
LangSmith project is shared with the other course modules.
Light imports on purpose (no backend/torch), so the hourly alert job stays cheap.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import statistics
import urllib.request
import warnings
from collections import defaultdict
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

# USD per 1M tokens (input, output). Check the provider's pricing page when models change.
PRICES = {
    "groq:openai/gpt-oss-120b": (0.15, 0.60),
    "groq:openai/gpt-oss-20b": (0.075, 0.30),
    "openai:gpt-4o-mini": (0.15, 0.60),
    # DeepSeek peak prices (upper bound). Off-peak (outside 01-04 & 06-10 UTC Mon-Fri) is half.
    "deepseek:deepseek-flash": (0.30, 1.20),
    "deepseek:deepseek-v4-pro": (1.32, 3.96),
}
DEFAULT_MODEL = os.getenv("CHAT_MODEL", "groq:openai/gpt-oss-120b")

ALERT_TOOL_ERROR_RATE = 0.10
ALERT_P95_SECONDS = 15.0
BUDGET_MSG = "reached its budget"


def cost_usd(input_tokens: int, output_tokens: int, model: str = DEFAULT_MODEL) -> float:
    pin, pout = PRICES.get(model, (0.0, 0.0))
    return ((input_tokens or 0) * pin + (output_tokens or 0) * pout) / 1_000_000


def _runs(since: datetime, **kw) -> list:
    from langsmith import Client

    # ponytail: list_runs is deprecated (removed after Jan 2027); its replacement
    # client.runs.query is async-only. Migrate when this stops working.
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", DeprecationWarning)
        return list(Client().list_runs(
            project_name=os.getenv("LANGSMITH_PROJECT", "default"),
            start_time=since,
            filter='has(tags, "module10")',
            **kw,
        ))


# Many tools catch their own exceptions and RETURN the error (TavilySearch gives
# "{'error': ValueError('Error 401...')}", our calculator "error: ..."), so LangSmith marks
# the run as a success. Found by breaking the Tavily key on purpose: the alert stayed quiet.
_RETURNED_ERROR = re.compile(r"""^\s*(\{\s*['"]error['"]|error\b)""", re.IGNORECASE)


def tool_failed(run) -> bool:
    out = (run.outputs or {}).get("output", run.outputs)
    content = out.get("content", "") if isinstance(out, dict) else out
    return run.error is not None or bool(_RETURNED_ERROR.match(str(content or "")))


def _pct(xs: list[float], p: float) -> float:
    if not xs:
        return 0.0
    xs = sorted(xs)
    return xs[min(len(xs) - 1, int(round(p * (len(xs) - 1))))]


def _secs(r) -> float:
    return (r.end_time - r.start_time).total_seconds() if r.end_time else 0.0


def summarize(roots: list, tools: list) -> dict:
    """One block of metrics for whatever window of runs it's given."""
    lat = [_secs(r) for r in roots if r.end_time]
    per_thread: dict[str, float] = defaultdict(float)
    for r in roots:
        md = (r.extra or {}).get("metadata", {})
        per_thread[md.get("thread_id", str(r.id))] += cost_usd(
            r.prompt_tokens, r.completion_tokens, md.get("model", DEFAULT_MODEL))
    by_tool: dict[str, list[int]] = defaultdict(lambda: [0, 0])  # name -> [ok, total]
    for t in tools:
        by_tool[t.name][1] += 1
        by_tool[t.name][0] += not tool_failed(t)
    total_tools = sum(v[1] for v in by_tool.values())
    return {
        "turns": len(roots),
        "conversations": len(per_thread),
        "p50_s": round(_pct(lat, 0.50), 2),
        "p95_s": round(_pct(lat, 0.95), 2),
        "tokens": sum(r.total_tokens or 0 for r in roots),
        "cost_usd": round(sum(per_thread.values()), 5),
        "cost_per_conversation_usd": round(statistics.mean(per_thread.values()), 6) if per_thread else 0.0,
        "tool_error_rate": round(1 - sum(v[0] for v in by_tool.values()) / total_tools, 3) if total_tools else 0.0,
        "tool_success": {k: f"{ok}/{n}" for k, (ok, n) in sorted(by_tool.items())},
        "budget_cap_hits": sum(BUDGET_MSG in json.dumps(r.outputs or {}) for r in roots),
    }


def fetch(since: datetime) -> tuple[list, list]:
    return _runs(since, is_root=True), _runs(since, run_type="tool")


def daily(days: int = 7) -> list[dict]:
    since = (datetime.now(timezone.utc) - timedelta(days=days)).replace(hour=0, minute=0, second=0, microsecond=0)
    roots, tools = fetch(since)
    day = lambda r: r.start_time.date().isoformat()  # noqa: E731
    out = []
    for d in sorted({day(r) for r in roots}, reverse=True):
        out.append({"day": d, **summarize([r for r in roots if day(r) == d],
                                          [t for t in tools if day(t) == d])})
    return out


def check_alert() -> tuple[bool, str]:
    roots, tools = fetch(datetime.now(timezone.utc) - timedelta(hours=1))
    s = summarize(roots, tools)
    problems = []
    if s["tool_error_rate"] > ALERT_TOOL_ERROR_RATE and len(tools) >= 3:
        problems.append(f"tool error rate {s['tool_error_rate']:.0%} ({s['tool_success']})")
    if s["p95_s"] > ALERT_P95_SECONDS and len(roots) >= 3:
        problems.append(f"p95 latency {s['p95_s']}s")
    if not problems:
        return False, f"ok: {s['turns']} turns, {len(tools)} tool calls in the last hour"
    return True, "Module 10 agent alert (last hour): " + "; ".join(problems)


def post_discord(text: str) -> None:
    url = os.getenv("DISCORD_WEBHOOK_URL")
    if not url:
        print("DISCORD_WEBHOOK_URL not set; alert printed only")
        return
    req = urllib.request.Request(url, data=json.dumps({"content": text}).encode(),
                                 headers={"Content-Type": "application/json", "User-Agent": "module10-alert"})
    urllib.request.urlopen(req, timeout=15)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--days", type=int, default=7)
    ap.add_argument("--alert", action="store_true")
    args = ap.parse_args()
    if args.alert:
        fire, msg = check_alert()
        print(msg)
        if fire:
            post_discord(msg)
    else:
        rows = daily(args.days)
        if not rows:
            print("no module10-tagged runs in that window")
        cols = ["day", "turns", "conversations", "p50_s", "p95_s", "tokens", "cost_usd",
                "cost_per_conversation_usd", "tool_error_rate", "budget_cap_hits"]
        print("  ".join(f"{c:>12}" for c in cols))
        for r in rows:
            print("  ".join(f"{str(r[c]):>12}" for c in cols))
            print(f"{'':>12}  tools: {r['tool_success']}")
