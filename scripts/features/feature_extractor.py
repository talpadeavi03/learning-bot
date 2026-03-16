import pandas as pd
import re
from pathlib import Path

INPUT_FILE = "data/raw/events.csv"
OUTPUT_FILE = "data/features/behavior_features.parquet"


def extract_minutes(text):
    """Extract duration from text"""
    text = text.lower()

    hours = re.search(r'(\d+)\s*hour', text)
    minutes = re.search(r'(\d+)\s*minute', text)

    total = 0

    if hours:
        total += int(hours.group(1)) * 60

    if minutes:
        total += int(minutes.group(1))

    return total


def extract_expense(text):
    """Extract money spent"""
    match = re.search(r'(\d+)', text)
    if match and "spent" in text.lower():
        return int(match.group(1))
    return 0


def extract_topic(text):
    """Detect learning topic"""
    text = text.lower()

    topics = [
        "kubernetes",
        "python",
        "mlops",
        "docker",
        "devops",
        "ai",
        "linux"
    ]

    for t in topics:
        if t in text:
            return t

    return "general"


def process_events(df):

    rows = []

    for _, row in df.iterrows():

        text = row["text"]

        minutes = extract_minutes(text)
        expense = extract_expense(text)
        topic = extract_topic(text)

        category = row["category"]

        study_minutes = minutes if category == "learning" else 0
        exercise_minutes = minutes if category == "exercise" else 0

        rows.append({
            "date": row["timestamp"][:10],
            "study_minutes": study_minutes,
            "exercise_minutes": exercise_minutes,
            "expense_amount": expense,
            "topic": topic
        })

    return pd.DataFrame(rows)


def main():

    df = pd.read_csv(INPUT_FILE)

    features = process_events(df)

    Path("data/features").mkdir(parents=True, exist_ok=True)

    features.to_parquet(OUTPUT_FILE, index=False)

    print("Feature dataset created:", OUTPUT_FILE)


if __name__ == "__main__":
    main()