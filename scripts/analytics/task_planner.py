import json
import random
from pathlib import Path

GOALS = "state/goals.json"
HABITS = "site/data/habits.json"
STATE = "state/current_state.json"
OUTPUT = "site/data/daily_plan.json"


def load_json(path):

    if not Path(path).exists():
        return None

    with open(path) as f:
        return json.load(f)


def build_plan():

    goals_data = load_json(GOALS)
    habits = load_json(HABITS)
    state = load_json(STATE)

    if not goals_data:
        return

    goals = goals_data.get("goals", [])

    plan = []

    # choose goals needing progress
    for g in goals:

        topic = g["topic"]

        if habits and topic in habits:

            streak = habits[topic]["max_streak"]

            if streak < 3:

                plan.append(
                    f"Work on {topic} for 30 minutes"
                )

        else:

            plan.append(
                f"Study {topic} for 30 minutes"
            )

    # energy-based suggestion
    if state:

        energy = state.get("energy", 0.5)

        if energy > 0.7:

            plan.append("Start a deep work session")

        elif energy < 0.4:

            plan.append("Take a short break")

    # random productivity suggestion
    tips = [
        "Review yesterday's notes",
        "Do a quick recap session",
        "Write down key learnings"
    ]

    plan.append(random.choice(tips))

    Path("site/data").mkdir(parents=True, exist_ok=True)

    with open(OUTPUT, "w") as f:
        json.dump({"plan": plan}, f, indent=2)

    print("[AETHER] daily plan generated")


if __name__ == "__main__":
    build_plan()