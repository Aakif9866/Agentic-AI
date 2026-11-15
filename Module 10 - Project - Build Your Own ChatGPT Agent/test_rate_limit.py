"""uv run python test_rate_limit.py  — the 15/hour limiter, with a fake clock."""
from backend import RATE_LIMIT_PER_HOUR as N, rate_limit

t0 = 1_000_000.0
for i in range(N):
    ok, left, _ = rate_limit("a", now=t0 + i)
    assert ok and left == N - 1 - i
assert rate_limit("a", consume=False, now=t0 + N) == (False, 0, 3600 - N + 1)
ok, _, wait = rate_limit("a", now=t0 + 60)
assert not ok and wait == 3600 - 60 + 1, wait          # blocked, says when
assert rate_limit("b", now=t0 + 60)[0]                 # other visitors unaffected
assert rate_limit("a", now=t0 + 3600)[0]               # oldest slot expired after 1h
print(f"rate limit OK ({N}/hour)")
