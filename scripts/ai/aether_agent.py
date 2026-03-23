import json
import os
import sys
from scripts.analytics.goal_engine import goal_summary

# -----------------------------------
# Add project root to Python path
# -----------------------------------

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
)

from scripts.analytics.vector_query import search
from scripts.ai.intent_classifier import classify
from scripts.analytics.temporal_engine import yesterday_summary

PATTERNS = "site/data/patterns.json"
INSIGHTS = "site/data/insights.json"
DASHBOARD = "site/data/dashboard.json"
STATE = "state/current_state.json"


# -----------------------------------
# JSON loader
# -----------------------------------

def load_json(path):

    if not os.path.exists(path):
        return None

    try:
        with open(path) as f:
            return json.load(f)
    except Exception:
        return None


# -----------------------------------
# Safe extractor helpers
# -----------------------------------

def extract_patterns(data):

    if not data:
        return []

    if isinstance(data, dict) and "patterns" in data:
        return data["patterns"]

    if isinstance(data, list):
        return data

    return []


def extract_insights(data):

    if not data:
        return []

    if isinstance(data, dict) and "insights" in data:
        return data["insights"]

    if isinstance(data, list):
        return data

    return []


# -----------------------------------
# State loader (AETHER v4)
# -----------------------------------

def load_state():

    if not os.path.exists(STATE):
        return None

    try:
        with open(STATE) as f:
            return json.load(f)
    except Exception:
        return None


# -----------------------------------
# Recommendation engine
# -----------------------------------

def recommendation_from_state(state):

    if not state:
        return None

    energy = state.get("energy", 0.5)
    focus = state.get("focus", 0.5)

    if energy > 0.7:
        return "Energy is high. Good time for deep work."

    if focus < 0.4:
        return "Focus seems low. Consider taking a short break."

    return None


# -----------------------------------
# AETHER reasoning engine
# -----------------------------------

def answer_question(question):

    answer = []

    intent = classify(question)

    if intent == "goal":
        answer.append(goal_summary())
    return "\n".join(answer)

    # -------------------------
    # Intent classification
    # -------------------------

    intent = classify(question)

    # Temporal questions handled separately
    if intent == "temporal":
        answer.append(yesterday_summary())
        return "\n".join(answer)

    # -------------------------
    # Vector memory search
    # -------------------------

    try:
        memories = search(question)
    except Exception:
        memories = []

    # -------------------------
    # Load intelligence layers
    # -------------------------

    patterns_raw = load_json(PATTERNS)
    insights_raw = load_json(INSIGHTS)
    dashboard = load_json(DASHBOARD)
    state = load_state()

    patterns = extract_patterns(patterns_raw)
    insights = extract_insights(insights_raw)

    # -------------------------
    # State awareness (AETHER v4)
    # -------------------------

    if state:

        energy = state.get("energy")
        focus = state.get("focus")
        last_activity = state.get("last_activity")

        if energy is not None:
            answer.append(f"Current energy level: {energy:.2f}")

        if focus is not None:
            answer.append(f"Current focus level: {focus:.2f}")

        if last_activity:
            answer.append(f"Last activity: {last_activity}")

    # -------------------------
    # Dashboard flow state
    # -------------------------

    if dashboard and "flow_state" in dashboard:

        flow = dashboard["flow_state"]
        answer.append(f"Current flow state: {flow}")

    # -------------------------
    # Pattern engine results
    # -------------------------

    for p in patterns:

        if p.get("type") == "peak_hour":

            hour = p.get("hour", "?")

            answer.append(
                f"Your peak productivity is around {hour}:00."
            )

    # -------------------------
    # Insight engine results
    # -------------------------

    for i in insights[:2]:

        body = i.get("body") or i.get("text")

        if body:
            answer.append(body)

    # -------------------------
    # Vector memory recall
    # -------------------------

    if memories:

        answer.append("\nRelevant past events:")

        for m in memories[:3]:

            text = m.get("text", "")
            ts = m.get("timestamp", "")

            answer.append(f"- {text} ({ts})")

    # -------------------------
    # Recommendation engine
    # -------------------------

    rec = recommendation_from_state(state)

    if rec:
        answer.append(f"\nRecommendation: {rec}")

    if not answer:
        answer.append("No data yet. Keep logging events.")

    return "\n".join(answer)


# -----------------------------------
# CLI Interface
# -----------------------------------

if __name__ == "__main__":

    q = input("Ask AETHER: ")

    print("\n--- AETHER RESPONSE ---\n")

    print(answer_question(q))