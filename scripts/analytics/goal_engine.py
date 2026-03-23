import json
import pandas as pd
from pathlib import Path

GOALS_FILE = "state/goals.json"
DATA_FILE = "data/processed/events_clean.csv"


def load_goals():

    if not Path(GOALS_FILE).exists():
        return []

    with open(GOALS_FILE) as f:
        data = json.load(f)

    return data.get("goals", [])


def compute_progress():

    if not Path(DATA_FILE).exists():
        return []

    df = pd.read_csv(DATA_FILE)

    if df.empty:
        return []

    goals = load_goals()

    results = []

    for g in goals:

        topic = g["topic"]

        count = df[df["topic"].str.contains(topic, case=False, na=False)].shape[0]

        target = g["target_sessions"]

        progress = round((count / target) * 100, 1)

        results.append({
            "goal": g["name"],
            "topic": topic,
            "progress": progress,
            "sessions": count
        })

    return results


def goal_summary():

    results = compute_progress()

    if not results:
        return "No goals tracked yet."

    lines = []

    for r in results:

        lines.append(
            f"{r['goal']}: {r['progress']}% complete ({r['sessions']} sessions)"
        )

    return "\n".join(lines)


if __name__ == "__main__":
    print(goal_summary())