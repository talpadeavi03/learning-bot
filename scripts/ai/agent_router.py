import os
import sys

sys.path.append(
    os.path.abspath(os.path.join(os.path.dirname(__file__), "../.."))
)

from scripts.ai.intent_classifier import classify
from scripts.analytics.goal_engine import goal_summary
from scripts.analytics.temporal_engine import yesterday_summary
from scripts.ai.context_builder import build_context
from scripts.ai.response_generator import generate_response


def route(question):

    intent = classify(question)

    # goal agent
    if intent == "goal":
        return goal_summary()

    # temporal agent
    if intent == "temporal":
        return yesterday_summary()

    # reasoning agent
    context = build_context(question)

    return generate_response(question, context)