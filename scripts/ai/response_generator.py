def generate_response(question, context):

    lines = []

    state = context.get("state")
    habits = context.get("habits")
    insights = context.get("insights")
    patterns = context.get("patterns")
    plan = context.get("plan")
    memories = context.get("memories")


    graph = context.get("graph")

    if graph:

      lines.append("\nRelated concepts:")

      for g in graph[:5]:
         lines.append(f"- {g}")

    # -------------------------
    # State summary
    # -------------------------

    if state:

        energy = state.get("energy")
        focus = state.get("focus")

        if energy is not None:
            lines.append(f"Energy level: {energy:.2f}")

        if focus is not None:
            lines.append(f"Focus level: {focus:.2f}")

    # -------------------------
    # Insights
    # -------------------------

    if insights:
        insight_list = insights.get("insights", []) if isinstance(insights, dict) else (insights if isinstance(insights, list) else [])
        for i in insight_list[:3]:
            body = i if isinstance(i, str) else (i.get("body") or i.get("text") or str(i) if isinstance(i, dict) else str(i))
            if body:
                lines.append(f"• {body}")

    # -------------------------
    # Patterns
    # -------------------------

    if patterns and isinstance(patterns, list):
        for p in patterns[:3]:
            if isinstance(p, dict):
                if p.get("type") == "peak_hour" and p.get("hour"):
                    lines.append(f"Your productivity peaks around {p.get('hour')}:00.")
                elif p.get("description"):
                    lines.append(f"• {p.get('description')}")

    # -------------------------
    # Habits
    # -------------------------

    if habits:

        lines.append("\nHabit summary:")

        for topic, h in habits.items():

            lines.append(
                f"{topic}: {h['max_streak']} day streak"
            )

    # -------------------------
    # Plan
    # -------------------------

    if plan and "plan" in plan:

        lines.append("\nToday's suggested plan:")

        for p in plan["plan"]:
            lines.append(f"- {p}")

    # -------------------------
    # Memories
    # -------------------------

    if memories:

        lines.append("\nRelevant past events:")

        for m in memories[:3]:

            text = m.get("text")
            ts = m.get("timestamp")

            lines.append(f"- {text} ({ts})")

    if not lines:
        return "I don't have enough data yet. Keep logging activities."

    return "\n".join(lines)