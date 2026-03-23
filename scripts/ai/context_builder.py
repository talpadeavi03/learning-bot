import json
import os
import sys

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
)

from scripts.analytics.vector_query import search

PATTERNS = "site/data/patterns.json"
INSIGHTS = "site/data/insights.json"
HABITS = "site/data/habits.json"
PLAN = "site/data/daily_plan.json"
STATE = "state/current_state.json"


def load_json(path):

    if not os.path.exists(path):
        return None

    with open(path) as f:
        return json.load(f)


def build_context(question):

    context = {}

    # state
    context["state"] = load_json(STATE)

    # habits
    context["habits"] = load_json(HABITS)

    # insights
    context["insights"] = load_json(INSIGHTS)

    # patterns
    context["patterns"] = load_json(PATTERNS)

    # daily plan
    context["plan"] = load_json(PLAN)

    # vector memory
    try:
        context["memories"] = search(question)
    except Exception:
        context["memories"] = []

    return context