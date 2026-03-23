import json
import os
import sys

# -----------------------------------
# Add project root to Python path
# -----------------------------------

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
)

from scripts.analytics.vector_query import search

PATTERNS = "site/data/patterns.json"
INSIGHTS = "site/data/insights.json"
DASHBOARD = "site/data/dashboard.json"


# -----------------------------------
# JSON loader
# -----------------------------------

def load_json(path):

    if not os.path.exists(path):
        return None

    with open(path) as f:
        return json.load(f)


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
# AETHER reasoning engine
# -----------------------------------

def answer_question(question):

    answer = []

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

    patterns = extract_patterns(patterns_raw)
    insights = extract_insights(insights_raw)

    # -------------------------
    # Reasoning logic
    # -------------------------

    if dashboard and "flow_state" in dashboard:

        flow = dashboard["flow_state"]
        answer.append(f"Current flow state: {flow}")

    # Pattern engine results

    for p in patterns:

        if p.get("type") == "peak_hour":

            hour = p.get("hour", "?")

            answer.append(
                f"Your peak productivity is around {hour}:00."
            )

    # Insight engine results

    for i in insights[:2]:

        body = i.get("body") or i.get("text")

        if body:
            answer.append(body)

    # Vector memory recall

    if memories:

        answer.append("\nRelevant past events:")

        for m in memories[:3]:

            text = m.get("text", "")
            ts = m.get("timestamp", "")

            answer.append(f"- {text} ({ts})")

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