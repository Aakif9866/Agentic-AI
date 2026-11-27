"""The app:  uv run streamlit run ui_streamlit.py

Talks to the graph directly (not through the API). This is also what the Docker
image serves, so it is the public face of the agent: Klyro "Spectrum" styling,
behind a single-user login (auth.py), 15 questions per hour, all your chats in the sidebar.
"""
import html
import uuid

import streamlit as st
from langchain_core.messages import AIMessageChunk, ToolMessage
from langgraph.types import Command

from auth import require_login
from backend import (
    CHAT_MODEL, DATABASE_URL, RATE_LIMIT_PER_HOUR, agent, all_thread_ids, checkpointer,
    pending_approval, rate_limit, run_config, thread_title,
)

st.set_page_config(page_title="Agent", page_icon="✦", layout="centered")

# Each tool owns one colour (Klyro "area tones"), so the badge says what was used.
TOOL_BADGE = {
    "calculator": ":orange-badge[:material/calculate: calculator]",
    "tavily_search": ":blue-badge[:material/travel_explore: web search]",
    "search_docs": ":green-badge[:material/description: your PDF]",
    "send_email": ":violet-badge[:material/mail: email]",
}
SUGGESTIONS = [
    (":material/calculate: Do some maths", "What is 128 * 47 minus 300? Use the calculator."),
    (":material/travel_explore: Search the web", "Search the web: what is the latest news about LangGraph?"),
    (":material/description: Ask the PDF", "According to my PDF, what are checkpointers for? Cite pages."),
    (":material/mail: Draft an email", "Email team@example.com with subject Status: the agent demo is ready."),
]

st.markdown(
    """
<style>
:root{
  --bg:#000;--surface:#0a0a0a;--surface-2:#151515;--border:#262626;
  --text:#e5e5e5;--heading:#fff;--muted:#a3a3a3;--accent:#c084fc;
  --g:linear-gradient(135deg,#6d28d9,#be185d);      /* deep: carries white text */
  --gb:linear-gradient(90deg,#a78bfa,#f472b6);      /* bright: strips, glow, meter */
}
.klyro-strip{position:fixed;top:0;left:0;right:0;height:3px;background:var(--gb);z-index:1000001}
header[data-testid="stHeader"]{background:transparent}
[data-testid="stAppDeployButton"]{display:none}
[data-testid="stSidebar"]{background:var(--surface);border-right:1px solid var(--border)}

.brand{display:flex;align-items:center;gap:.6rem;font-weight:800;font-size:1.2rem;color:var(--heading)}
.brand-mark{width:30px;height:30px;display:grid;place-items:center;background:var(--g);
  color:#fff;border-radius:10px 0 10px 0}
.label{font-size:.72rem;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:1.1rem 0 .4rem}
.meter{height:6px;background:var(--surface-2);border-radius:99px;overflow:hidden}
.meter>i{display:block;height:100%;background:var(--gb);transition:width .3s ease-out}
.meter-text{font-size:.85rem;color:var(--muted);margin-top:.35rem}
.spec{border:1px solid var(--border);border-radius:14px 0 14px 0;padding:.75rem .9rem;font-size:.85rem;color:var(--muted)}
.spec b{color:var(--text);font-weight:600}

.hero{position:relative;overflow:hidden;background:var(--surface);border:1px solid var(--border);
  border-radius:28px 0 28px 0;padding:2.25rem 1.5rem;margin:.5rem 0 1.25rem}
.hero::before{content:"";position:absolute;top:-90px;right:-70px;width:280px;height:280px;
  background:var(--gb);filter:blur(60px);opacity:.35}
.hero h1{position:relative;font-size:2.1rem;line-height:1.08;font-weight:800;color:var(--heading);margin:0 0 .6rem;padding:0}
@media (min-width:1024px){.hero h1{font-size:3.4rem}}
.hero p{position:relative;color:var(--muted);margin:0;max-width:34rem}
.grad{background:var(--gb);-webkit-background-clip:text;background-clip:text;color:transparent}

[data-testid="stChatMessage"]{background:var(--surface);border:1px solid var(--border);
  border-radius:18px 0 18px 0;padding:.9rem 1rem;animation:rise .3s ease-out both}
[data-testid="stChatMessage"]:has([data-testid="stChatMessageAvatarUser"]){background:var(--surface-2)}

.stButton>button{background:var(--surface);color:var(--text);border:1px solid var(--border);
  border-radius:14px 0 14px 0;min-height:44px;transition:all .15s ease-out}
.stButton>button:hover{border-color:var(--accent);color:var(--accent);transform:translateY(-2px)}
.stButton>button:active{transform:scale(.97)}
[data-testid="stBaseButton-primary"]{background:var(--g)!important;color:#fff!important;border:0!important}

[data-testid="stChatInput"]{border:1px solid var(--border);border-radius:18px 0 18px 0;background:var(--surface)}
[data-testid="stChatInput"]:focus-within{border-color:var(--accent)}
[data-testid="stChatInputSubmitButton"]{background:var(--g);color:#fff;border-radius:10px 0 10px 0}

.approve{background:var(--surface) var(--gb) top/100% 3px no-repeat;border:1px solid #6d28d9;
  border-radius:20px 0 20px 0;padding:1rem 1.25rem;margin:.75rem 0;animation:rise .3s ease-out both}
.approve h4{margin:0 0 .35rem;padding:0;color:var(--heading)}
.approve div{color:var(--muted);font-size:.9rem}

@keyframes rise{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}
</style>
<div class="klyro-strip"></div>
""",
    unsafe_allow_html=True,
)

require_login()  # nothing below runs until signed in

# Titles never change once a chat starts, so cache them (one DB read per thread, ever).
thread_title = st.cache_data(show_spinner=False)(thread_title)


def visitor_key() -> str:
    """Who to rate-limit. Render sits behind Cloudflare, which sets CF-Connecting-IP
    itself (a client can't fake it through Cloudflare); fall back for local runs."""
    h = st.context.headers
    forwarded = (h.get("X-Forwarded-For") or "").split(",")[-1].strip()
    return h.get("CF-Connecting-IP") or forwarded or st.context.ip_address or "local"


def badges(names) -> str:
    return " ".join(TOOL_BADGE.get(n, f":gray-badge[{n}]") for n in dict.fromkeys(names))


# The thread lives in the URL (?t=...), so a refresh keeps the conversation.
if "t" not in st.query_params:
    st.query_params["t"] = str(uuid.uuid4())
thread_id = st.query_params["t"]
cfg = {"configurable": {"thread_id": thread_id}}  # reads only; agent runs use run_config()
messages = agent.get_state(cfg).values.get("messages", [])

# ---------- sidebar ----------
with st.sidebar:
    st.markdown('<div class="brand"><span class="brand-mark">✦</span>Agent</div>', unsafe_allow_html=True)
    st.write("")
    if st.button(":material/add: New chat", use_container_width=True):
        st.query_params["t"] = str(uuid.uuid4())
        st.rerun()
    if messages and st.button(":material/delete: Delete this chat", use_container_width=True):
        checkpointer.delete_thread(thread_id)  # every checkpoint of this thread, gone
        st.query_params["t"] = str(uuid.uuid4())
        st.rerun()

    # Every thread in the DB. Safe now: only the one logged-in user gets this far.
    tids = all_thread_ids()
    if tids:
        st.markdown('<div class="label">Your chats</div>', unsafe_allow_html=True)
        for tid in tids[:30]:
            if st.button(thread_title(tid), key=tid, use_container_width=True, disabled=tid == thread_id):
                st.query_params["t"] = tid
                st.rerun()

    _, left, _ = rate_limit(visitor_key(), consume=False)
    st.markdown(
        f'<div class="label">Questions this hour</div>'
        f'<div class="meter"><i style="width:{left / max(RATE_LIMIT_PER_HOUR, 1) * 100:.0f}%"></i></div>'
        f'<div class="meter-text">{left} of {RATE_LIMIT_PER_HOUR} left</div>',
        unsafe_allow_html=True,
    )

    provider, _, model = CHAT_MODEL.partition(":")
    st.markdown(
        f'<div class="label">Under the hood</div><div class="spec">'
        f"<b>Model</b> {html.escape(model)} on {html.escape(provider.title())}<br>"
        f"<b>Web search</b> Tavily<br><b>PDF search</b> FAISS + MiniLM<br>"
        f"<b>Memory</b> LangGraph checkpoints on {'Postgres' if DATABASE_URL else 'SQLite'}</div>",
        unsafe_allow_html=True,
    )

# ---------- conversation ----------
if not messages:
    st.markdown(
        '<div class="hero"><h1>Ask anything.<br><span class="grad">It uses tools.</span></h1>'
        "<p>A LangGraph agent that does maths with a calculator, searches the web, reads your PDF "
        "and drafts emails, but asks you before it sends one.</p></div>",
        unsafe_allow_html=True,
    )
    cols = st.columns(2)
    for i, (label, prompt) in enumerate(SUGGESTIONS):
        if cols[i % 2].button(label, key=f"s{i}", use_container_width=True):
            st.session_state.queued = prompt
            st.rerun()

used: list[str] = []
for m in messages:
    if m.type == "human":
        used = []
        st.chat_message("user", avatar=":material/person:").write(m.content)
    elif m.type == "ai":
        used += [c["name"] for c in getattr(m, "tool_calls", [])]
        if m.content:
            with st.chat_message("assistant", avatar=":material/auto_awesome:"):
                if used:
                    st.markdown(badges(used))
                st.markdown(m.content)
            used = []

# 👍/👎 on the latest answer, attached to its LangSmith trace (Phase 5c).
last_run = st.session_state.get("last_run", {}).get(thread_id)
if last_run and messages and messages[-1].type == "ai" and messages[-1].content:
    score = st.feedback("thumbs", key=f"fb-{last_run}")
    sent = st.session_state.setdefault("feedback_sent", set())
    if score is not None and last_run not in sent:
        try:
            from langsmith import Client

            Client().create_feedback(last_run, key="user_thumbs", score=score)
            sent.add(last_run)
            st.toast("Thanks, feedback saved to the trace.")
        except Exception as e:  # tracing off or LangSmith down: never break the chat
            st.toast(f"Couldn't save feedback: {e}")

# ---------- human approval ----------
draft = pending_approval(thread_id)
if draft:
    st.markdown(
        f'<div class="approve"><h4>Approve this email?</h4><div>To <b>{html.escape(draft["to"])}</b>'
        f' · {html.escape(draft["subject"])}</div></div>',
        unsafe_allow_html=True,
    )
    edited = st.text_area("Body, edit it before sending if you like", draft["body"], height=180)
    a, b = st.columns(2)
    if a.button(":material/send: Approve & send", type="primary", use_container_width=True):
        agent.invoke(Command(resume={"approved": True, "edited_body": edited}),
                     run_config(thread_id, "approval"))
        st.rerun()
    if b.button(":material/close: Reject", use_container_width=True):
        agent.invoke(Command(resume={"approved": False}), run_config(thread_id, "approval"))
        st.rerun()
    st.stop()

# ---------- new question ----------
prompt = st.chat_input("Ask anything", max_chars=2000) or st.session_state.pop("queued", None)
if prompt:
    allowed, _, wait = rate_limit(visitor_key())
    if not allowed:
        st.error(
            f"You've used all {RATE_LIMIT_PER_HOUR} questions for this hour. "
            f"Next one frees up in about {wait // 60 + 1} min.",
            icon=":material/hourglass_top:",
        )
        st.stop()

    st.chat_message("user", avatar=":material/person:").write(prompt)
    with st.chat_message("assistant", avatar=":material/auto_awesome:"):
        chips, box = st.empty(), st.empty()
        acc, tools = "", []
        rcfg = run_config(thread_id)
        st.session_state.setdefault("last_run", {})[thread_id] = str(rcfg["run_id"])
        for chunk, _meta in agent.stream({"messages": [("user", prompt)]}, rcfg, stream_mode="messages"):
            if isinstance(chunk, ToolMessage):
                tools.append(chunk.name)
                chips.markdown(badges(tools))
            elif isinstance(chunk, AIMessageChunk) and chunk.content:
                acc += chunk.content
                box.markdown(acc)
    st.rerun()
