import pandas as pd
from pathlib import Path

DATA = "data/processed/events_clean.csv"

def yesterday_summary():

    if not Path(DATA).exists():
        return "No historical data."

    df = pd.read_csv(DATA)

    if df.empty:
        return "No events logged."

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

    yesterday = df["timestamp"].max().normalize() - pd.Timedelta(days=1)

    y = df[df["timestamp"].dt.normalize() == yesterday]

    if y.empty:
        return "No events recorded yesterday."

    topics = y["topic"].value_counts().to_dict()

    return f"Yesterday you focused mostly on: {', '.join(topics.keys())}."