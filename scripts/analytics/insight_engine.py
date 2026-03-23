"""
AETHER Insight Engine
Generates behavioral insights from processed event data.
"""

import json
import pandas as pd
from pathlib import Path
from datetime import datetime, timezone

INPUT_PATH = "data/processed/events_clean.csv"
OUTPUT_PATH = "site/data/insights.json"


def load_data():

    if not Path(INPUT_PATH).exists():
        print("[AETHER] No processed dataset found")
        return pd.DataFrame()

    df = pd.read_csv(INPUT_PATH)

    print(f"[AETHER] Loaded {len(df)} events")

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    return df


def peak_hour(df):

    if "energy_signal" not in df.columns:
        return None

    hourly = df.groupby(df["timestamp"].dt.hour)["energy_signal"].mean()

    if hourly.empty:
        return None

    return int(hourly.idxmax())


def stress_level(df):

    if "stress_signal" not in df.columns:
        return None

    return float(df["stress_signal"].mean())


def focus_trend(df):

    if "focus_signal" not in df.columns:
        return None

    return float(df["focus_signal"].mean())


def study_topics(df):

    if "topic" not in df.columns:
        return []

    topics = df["topic"].value_counts().head(3)

    return topics.index.tolist()


def generate_insights(df):

    insights = []

    # Peak productivity hour
    ph = peak_hour(df)

    if ph is not None:
        insights.append({
            "icon": "⚡",
            "title": "Peak productivity hour",
            "body": f"Your energy peaks around {ph}:00. Schedule deep work then.",
            "tag": "PATTERN"
        })

    # Stress analysis
    stress = stress_level(df)

    if stress is not None:

        if stress > 0.7:
            insights.append({
                "icon": "⚠️",
                "title": "High stress detected",
                "body": "Your average stress level is elevated. Consider rest.",
                "tag": "HEALTH"
            })

        elif stress < 0.3:
            insights.append({
                "icon": "🧘",
                "title": "Low stress state",
                "body": "Your stress levels are currently low.",
                "tag": "BALANCE"
            })

    # Focus analysis
    focus = focus_trend(df)

    if focus is not None:

        if focus > 0.7:
            insights.append({
                "icon": "🔥",
                "title": "High focus detected",
                "body": "You are consistently entering high-focus states.",
                "tag": "FLOW"
            })

    # Study patterns
    topics = study_topics(df)

    if topics:

        insights.append({
            "icon": "📚",
            "title": "Top learning topics",
            "body": f"You have focused mostly on: {', '.join(topics)}.",
            "tag": "LEARNING"
        })

    return insights


def save_insights(insights):

    Path("site/data").mkdir(parents=True, exist_ok=True)

    data = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "insights": insights
    }

    with open(OUTPUT_PATH, "w") as f:
        json.dump(data, f, indent=2)

    print(f"[AETHER] Insights written → {OUTPUT_PATH}")


def main():

    df = load_data()

    if df.empty:
        print("[AETHER] No data to analyze")
        return

    insights = generate_insights(df)

    save_insights(insights)


if __name__ == "__main__":
    main()