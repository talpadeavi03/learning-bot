import pandas as pd
import re
import os

INPUT_FILE = "data/raw/events.csv"
OUTPUT_FILE = "data/features/behavior_features.parquet"

os.makedirs("data/features", exist_ok=True)

df = pd.read_csv(INPUT_FILE, on_bad_lines="skip")

signals = []

for _, row in df.iterrows():

    text = str(row.get("text", "")).lower()

    study_hours = 0
    coding_hours = 0
    learning_event = 0
    task_event = 0
    health_event = 0
    productivity_event = 0
    deep_work_event = 0
    fatigue_score = None
    mood_score = None
    reflection_event = 0
    expenses_today = 0
    topic = None

    if "study" in text or "learn" in text:
        learning_event = 1
        study_hours = 1

    if "code" in text or "python" in text:
        coding_hours = 1

    if "task" in text:
        task_event = 1

    if "eat" in text or "food" in text:
        health_event = 1

    if "tired" in text or "fatigue" in text:
        fatigue_score = 7

    if "happy" in text or "enjoyed" in text:
        mood_score = 8

    if "diary" in text:
        reflection_event = 1

    if "work" in text or "focus" in text:
        productivity_event = 1
        deep_work_event = 1

    # detect expenses
    if "spent" in text or "bought" in text:
        money = re.findall(r"\d+", text)
        if money:
            expenses_today = int(money[0])

    if "kubernetes" in text:
        topic = "kubernetes"

    signals.append({
        "timestamp": row["timestamp"],
        "user": row["user"],
        "study_hours": study_hours,
        "coding_hours": coding_hours,
        "learning_event": learning_event,
        "topic": topic,
        "task_event": task_event,
        "productivity_event": productivity_event,
        "deep_work_event": deep_work_event,
        "health_event": health_event,
        "fatigue_score": fatigue_score,
        "mood_score": mood_score,
        "reflection_event": reflection_event,
        "expenses_today": expenses_today
    })

features_df = pd.DataFrame(signals)

features_df.to_parquet(OUTPUT_FILE, index=False)

print("Feature extraction complete")