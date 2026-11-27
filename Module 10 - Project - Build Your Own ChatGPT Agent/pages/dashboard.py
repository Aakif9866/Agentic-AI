"""Metrics dashboard (Streamlit multipage: appears in the sidebar nav). Login required."""
import streamlit as st

from auth import require_login
from metrics import check_alert, daily

st.set_page_config(page_title="Dashboard", page_icon="✦", layout="wide")
require_login()

st.title("Agent metrics")
st.caption("From LangSmith traces tagged `module10`. Cost = tokens × the price table in metrics.py.")

days = st.segmented_control("Window", [1, 7, 30], default=7, format_func=lambda d: f"{d}d")


@st.cache_data(ttl=300, show_spinner="Pulling runs from LangSmith…")
def load(d: int):
    return daily(d)


rows = load(days or 7)
if not rows:
    st.info("No tagged runs in this window yet. Chat with the agent, then refresh.")
    st.stop()

today = rows[0]
c = st.columns(5)
c[0].metric("Turns", today["turns"], help=f"on {today['day']}")
c[1].metric("p95 latency", f"{today['p95_s']} s", help=f"p50 {today['p50_s']} s")
c[2].metric("Cost / conversation", f"${today['cost_per_conversation_usd']:.5f}")
c[3].metric("Tool error rate", f"{today['tool_error_rate']:.0%}")
c[4].metric("Budget-cap hits", today["budget_cap_hits"])

st.subheader("Per day")
st.dataframe(
    [{**r, "tool_success": ", ".join(f"{k} {v}" for k, v in r["tool_success"].items())} for r in rows],
    hide_index=True, width="stretch",
)

if st.button("Check alert rules now (last hour)"):
    fire, msg = check_alert()
    (st.error if fire else st.success)(msg)
