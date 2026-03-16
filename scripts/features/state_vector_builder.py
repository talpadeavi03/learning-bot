import pandas as pd
from pathlib import Path

INPUT_FILE = "data/features/behavior_features.parquet"
OUTPUT_FILE = "data/features/daily_behavior.parquet"

df = pd.read_parquet(INPUT_FILE)

df["date"] = pd.to_datetime(df["date"]).dt.date

state = df.groupby("date").agg({
    "study_minutes": "sum",
    "exercise_minutes": "sum",
    "expense_amount": "sum",
    "topic": "count"
}).rename(columns={"topic": "event_count"}).reset_index()

Path("data/features").mkdir(parents=True, exist_ok=True)

state.to_parquet(OUTPUT_FILE, index=False)

print("State vector dataset created:", OUTPUT_FILE)