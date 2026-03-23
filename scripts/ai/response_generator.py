def generate_response(question, context):

    lines = []

    state = context.get("state")
    habits = context.get("habits")
    insights = context.get("insights")
    patterns = context.get("patterns")
    plan = context.get("plan")
    memories = context.get("memories")

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

        for i in insights[:2]:

            body = i.get("body") or i.get("text")

            if body:
                lines.append(body)

    # -------------------------
    # Patterns
    # -------------------------

    if patterns:

        for p in patterns:

            if p.get("type") == "peak_hour":

                lines.append(
                    f"Your productivity peaks around {p.get('hour')}:00."
                )

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