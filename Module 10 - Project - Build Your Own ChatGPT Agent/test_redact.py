"""uv run python test_redact.py  — PII scrubbing for traces."""
from redact import redact, redact_text

assert redact_text("mail bob.smith+x@example.co.uk now") == "mail [REDACTED] now"
assert redact_text("call +1 (415) 555-0132 or 98765 43210") == "call [REDACTED] or [REDACTED]"
assert redact_text("What is 128 * 47 minus 300?") == "What is 128 * 47 minus 300?"   # maths untouched
assert redact_text("total 68.97, year 2026") == "total 68.97, year 2026"
assert redact_text("on 2026-11-27 at 10:30") == "on 2026-11-27 at 10:30"            # dates survive

nested = {"messages": [{"content": "to a@b.com", "n": 3}], "args": ("x@y.io", None)}
assert redact(nested) == {"messages": [{"content": "to [REDACTED]", "n": 3}], "args": ("[REDACTED]", None)}

from pydantic import BaseModel  # LangChain messages are pydantic models


class Msg(BaseModel):
    content: str


assert redact({"messages": [Msg(content="I'm a@b.com")]}) == {"messages": [{"content": "I'm [REDACTED]"}]}
print("redact OK")
