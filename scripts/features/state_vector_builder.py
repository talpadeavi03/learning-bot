import pandas as pd

INPUT_FILE = "data/features/behavior_features.parquet"
OUTPUT_FILE = "data/features/daily_state_vector.parquet"

df = pd.read_parquet(INPUT_FILE)

# convert timestamp → date
df["date"] = pd.to_datetime(df["timestamp"]).dt.date

# aggregate signals by day
state = df.groupby("date").agg({

    "study_hours": "sum",
    "coding_hours": "sum",

    "learning_event": "sum",
    "task_event": "sum",
    "productivity_event": "sum",

    "health_event": "sum",

    "fatigue_score": "mean",
    "mood_score": "mean",

    "expenses_today": "sum"

}).reset_index()

# rename aggregated indexes

state["learning_index"] = state["learning_event"]
state["productivity_index"] = state["task_event"] + state["productivity_event"]
state["health_index"] = state["health_event"]
state["emotion_index"] = state["mood_score"]
state["finance_index"] = state["expenses_today"]

state.to_parquet(OUTPUT_FILE, index=False)

print("Daily state vector generated")