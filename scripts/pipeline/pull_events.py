"""
AETHER OS — pull_events.py
Pulls events from Supabase → saves to data/raw/events.csv for ML pipeline
"""
import os, sys, json
from pathlib import Path
from datetime import datetime, timedelta

import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from scripts.db.supabase_client import get_recent_events

OUTPUT_PATH = Path("data/raw/events.csv")
OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

def pull():
    print("[pull_events] Fetching from Supabase...")
    events = get_recent_events(limit=1000)

    if not events:
        print("[pull_events] No events found in Supabase.")
        # fallback: try existing csv
        if OUTPUT_PATH.exists():
            print("[pull_events] Using existing events.csv as fallback.")
        return

    df = pd.DataFrame(events)

    # Normalise column names
    if "created_at" in df.columns and "timestamp" not in df.columns:
        df["timestamp"] = df["created_at"]

    # Flatten stat_impact jsonb → separate columns
    if "stat_impact" in df.columns:
        stat_df = df["stat_impact"].apply(
            lambda x: x if isinstance(x, dict) else {}
        ).apply(pd.Series).add_prefix("stat_")
        df = pd.concat([df.drop("stat_impact", axis=1), stat_df], axis=1)

    df.to_csv(OUTPUT_PATH, index=False)
    print(f"[pull_events] Saved {len(df)} events → {OUTPUT_PATH}")
    print(f"[pull_events] Date range: {df['timestamp'].min()} → {df['timestamp'].max()}")

if __name__ == "__main__":
    pull()
