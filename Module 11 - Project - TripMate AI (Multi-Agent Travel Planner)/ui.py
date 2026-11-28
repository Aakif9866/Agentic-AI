"""Streamlit front for TripMate. Run: uv run streamlit run ui.py"""
import uuid

import streamlit as st

from main import plan_trip

st.set_page_config(page_title="TripMate AI", page_icon="🧳")
st.title("🧳 TripMate AI")
st.caption("A supervisor routes your request to weather, places and budget agents, then assembles an itinerary.")

request = st.text_input("Your trip", "Plan a 3-day trip to Goa, budget ₹15000")

if st.button("Plan", type="primary") and request.strip():
    with st.spinner("Agents at work... (~30s)"):
        try:
            # Fresh thread per run: the checkpointer would otherwise accumulate state across runs.
            out = plan_trip(request, thread=str(uuid.uuid4()))
        except Exception as e:  # e.g. Groq daily limit, bad request
            st.error(f"Planning failed: {e}")
            st.stop()

    st.subheader(f"{out['destination']} · {out['days']} days · {out['budget']} {out['currency']}")
    st.write("**Route taken:** " + " → ".join(out["route_log"]))
    st.info(f"**Weather:** {out['weather']}")

    st.markdown("### Places")
    for n, w in zip(out["places"], out["places_why"]):
        st.markdown(f"- **{n}**: {w}")

    st.markdown(f"### Budget ({out['currency']})")
    st.table({"Item": [i["item"] for i in out["cost_items"]], "Amount": [i["amount"] for i in out["cost_items"]]})
    ok = out["cost_total"] <= out["budget"]
    (st.success if ok else st.warning)(f"Total {out['cost_total']} of {out['budget']} {'✓ within budget' if ok else '— over budget'}")

    st.markdown("### Itinerary")
    st.write(out["itinerary"]["summary"])
    for d in out["itinerary"]["days"]:
        with st.expander(f"Day {d['day']}", expanded=True):
            st.markdown(f"**Morning:** {d['morning']}\n\n**Afternoon:** {d['afternoon']}\n\n**Evening:** {d['evening']}")
