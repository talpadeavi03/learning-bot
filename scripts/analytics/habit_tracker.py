import pandas as pd
import json
from pathlib import Path

DATA_FILE = "data/processed/events_clean.csv"
OUTPUT = "site/data/habits.json"


def compute_habits():

    if not Path(DATA_FILE).exists():
        print("[AETHER] No dataset found")
        return

    df = pd.read_csv(DATA_FILE)

    if df.empty:
        print("[AETHER] Dataset empty")
        return

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    df["date"] = df["timestamp"].dt.date

    habits = {}

    for topic in df["topic"].dropna().unique():

        topic_df = df[df["topic"] == topic]

        days = sorted(topic_df["date"].unique())

        streak = 0
        max_streak = 0
        prev_day = None

        for d in days:

            if prev_day is None:
                streak = 1
            else:
                diff = (d - prev_day).days

                if diff == 1:
                    streak += 1
                else:
                    streak = 1

            max_streak = max(max_streak, streak)
            prev_day = d

        habits[topic] = {
            "days_active": len(days),
            "max_streak": int(max_streak)
        }

    Path("site/data").mkdir(parents=True, exist_ok=True)

    with open(OUTPUT, "w") as f:
        json.dump(habits, f, indent=2)

    print("[AETHER] habits updated")


if __name__ == "__main__":
    compute_habits()