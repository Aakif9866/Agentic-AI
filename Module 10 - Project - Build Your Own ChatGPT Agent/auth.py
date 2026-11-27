"""Single-user login. Credentials come from env vars, never from code (the repo is public).

    APP_USERNAME, APP_PASSWORD  the one login
    APP_SECRET                  long random string that signs API tokens

Fails closed: if any of them is unset, nobody can log in.
"""
import hashlib
import hmac
import os
import time

from dotenv import load_dotenv

load_dotenv()

TOKEN_TTL = 24 * 3600


def _env(name: str) -> str:
    return os.getenv(name, "")


def check_login(username: str, password: str) -> bool:
    user, pw = _env("APP_USERNAME"), _env("APP_PASSWORD")
    if not (user and pw and _env("APP_SECRET")):
        return False
    # compare_digest: constant time, so response timing doesn't leak how much matched.
    # Bitwise & (not `and`) so both comparisons always run.
    return hmac.compare_digest(username.encode(), user.encode()) & hmac.compare_digest(
        password.encode(), pw.encode()
    )


def _sign(payload: str, secret: str) -> str:
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


def make_token(now: float | None = None) -> str:
    """'<expiry>.<signature>'. Stateless: nothing stored server-side."""
    expiry = str(int((now or time.time()) + TOKEN_TTL))
    return f"{expiry}.{_sign(expiry, _env('APP_SECRET'))}"


def verify_token(token: str, now: float | None = None) -> bool:
    secret = _env("APP_SECRET")
    expiry, _, sig = (token or "").partition(".")
    if not (secret and expiry.isdigit() and sig):
        return False
    if not hmac.compare_digest(sig, _sign(expiry, secret)):
        return False
    return int(expiry) > (now or time.time())


def require_login() -> None:
    """Streamlit gate: call at the top of every page. Stops the script until logged in."""
    import streamlit as st

    if st.session_state.get("logged_in"):
        return
    st.markdown("### Sign in")
    with st.form("login"):
        u = st.text_input("Username")
        p = st.text_input("Password", type="password")
        if st.form_submit_button("Sign in", type="primary"):
            if check_login(u, p):
                st.session_state["logged_in"] = True
                st.rerun()
            st.error("Wrong username or password.")
    st.stop()
