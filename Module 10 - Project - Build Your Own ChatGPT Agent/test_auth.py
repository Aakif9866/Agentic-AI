"""uv run python test_auth.py  — login + token checks, no network, fake env."""
import os

os.environ.update(APP_USERNAME="me", APP_PASSWORD="pw", APP_SECRET="s3cret")
from auth import TOKEN_TTL, check_login, make_token, verify_token  # noqa: E402

assert check_login("me", "pw")
assert not check_login("me", "wrong") and not check_login("you", "pw")

t0 = 1_000_000.0
tok = make_token(now=t0)
assert verify_token(tok, now=t0 + 60)
assert not verify_token(tok, now=t0 + TOKEN_TTL + 1)            # expired
expiry, sig = tok.split(".")
assert not verify_token(f"{int(expiry) + 999}.{sig}", now=t0)    # tampered expiry
assert not verify_token("", now=t0) and not verify_token("garbage", now=t0)

os.environ["APP_SECRET"] = "other"
assert not verify_token(tok, now=t0)                             # wrong secret

os.environ["APP_SECRET"] = ""
assert not check_login("me", "pw") and not verify_token(tok, now=t0)  # fails closed
print("auth OK")
