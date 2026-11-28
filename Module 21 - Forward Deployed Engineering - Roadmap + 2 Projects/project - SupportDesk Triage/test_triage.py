"""Key-free checks for the code-owned parts: policy, retrieval, draft check.

    env -u GROQ_API_KEY uv run python test_triage.py
"""
from kb import retrieve
from triage import check_draft, policy  # import must not need a key

calm = {"category": "billing", "priority": "low", "sentiment": "calm", "refund_or_legal": False}
assert policy(calm) == []
assert policy({**calm, "refund_or_legal": True}) == ["refund or legal request"]
assert policy({**calm, "sentiment": "angry", "priority": "urgent"}) == ["angry customer", "urgent priority"]
assert policy({**calm, "category": "other"}) == ["no matching category"]

assert retrieve("I was charged twice on my bank statement", "billing") == "KB-02"
assert retrieve("how do I replace my card for payment", "billing") == "KB-01"
assert retrieve("forgot password, reset email never arrives", "account") == "KB-03"
assert retrieve("lost my phone, 2fa backup code", "account") == "KB-04"
assert retrieve("where is my delivery? tracking link shows nothing", "shipping") == "KB-08"
assert retrieve("charged twice", "shipping") is None          # wrong category -> no article
assert retrieve("hello", "billing") is None                    # too little overlap
assert retrieve("dark mode please", "feature_request") == "KB-10"

assert check_draft("Clear the cache and restart. Source: [KB-06]", "KB-06") == []
assert check_draft("Clear the cache.", "KB-06") == ["draft does not cite its article"]
assert check_draft("We'll refund you. Source: [KB-02]", "KB-02") == ["draft mentions 'refund' but the article does not"]

print("all triage checks passed")
