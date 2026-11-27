"""Scrub emails and phone numbers from anything before it is sent to LangSmith.

Only the *trace* is redacted; the agent itself still sees the real values.
Stdlib only, so the test runs in CI without the heavy env.
"""
import re

EMAIL = re.compile(r"[\w.+-]+@[\w-]+(?:\.[\w-]+)+")
# 9+ digits, allowing +, spaces, dots, dashes and brackets between them.
# ponytail: heuristic, also hits long numeric IDs; swap for a real PII library if needed.
PHONE = re.compile(r"\+?\(?\d[\d\s().-]{7,}\d")


def _phone(m: re.Match) -> str:
    # Count real digits so dates (2026-11-27) and prices survive.
    return "[REDACTED]" if sum(c.isdigit() for c in m.group()) >= 9 else m.group()


def redact_text(s: str) -> str:
    return PHONE.sub(_phone, EMAIL.sub("[REDACTED]", s))


def redact(obj):
    """Walk dicts/lists/tuples/pydantic models and redact every string."""
    if isinstance(obj, str):
        return redact_text(obj)
    if isinstance(obj, dict):
        return {k: redact(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple)):
        return type(obj)(redact(v) for v in obj)
    if hasattr(obj, "model_dump"):  # pydantic, incl. LangChain messages inside graph state
        return redact(obj.model_dump())
    return obj
