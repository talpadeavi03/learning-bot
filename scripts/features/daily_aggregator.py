"""
daily_aggregator.py — Daily Feature Aggregator
Aggregates daily statistics from events.csv into data/features/daily_behavior.parquet (and CSV).
"""

import os
import csv
from datetime import datetime
from collections import defaultdict
from pathlib import Path

INPUT_FILE = "data/raw/events.csv"
OUTPUT_FILE = "data/features/daily_behavior.parquet"
OUTPUT_CSV = "data/features/daily_behavior.csv"

def aggregate():
    if not os.path.exists(INPUT_FILE):
        print(f"[daily_aggregator] {INPUT_FILE} not found")
        return

    days = defaultdict(lambda: {
        "study_minutes": 0,
        "exercise_minutes": 0,
        "expense_amount": 0,
        "events_count": 0,
        "energy_sum": 0.0,
        "focus_sum": 0.0,
        "stress_sum": 0.0,
    })

    with open(INPUT_FILE, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for r in reader:
            ts = r.get("timestamp", "")
            if not ts or len(ts) < 10:
                continue
            d = ts[:10]
            data = days[d]
            data["events_count"] += 1
            data["study_minutes"] += int(float(r.get("estimated_minutes", 0) or 0)) if r.get("is_study_session") == "1.0" else 0
            data["exercise_minutes"] += int(float(r.get("estimated_minutes", 0) or 0)) if r.get("category") == "exercise" else 0
            data["energy_sum"] += float(r.get("energy_signal", 0.5) or 0.5)
            data["focus_sum"] += float(r.get("focus_signal", 0.5) or 0.5)
            data["stress_sum"] += float(r.get("stress_signal", 0.2) or 0.2)

    rows = []
    for d, v in sorted(days.items()):
        c = max(v["events_count"], 1)
        rows.append({
            "date": d,
            "events_count": v["events_count"],
            "study_minutes": v["study_minutes"],
            "exercise_minutes": v["exercise_minutes"],
            "expense_amount": v["expense_amount"],
            "avg_energy": round(v["energy_sum"] / c, 3),
            "avg_focus": round(v["focus_sum"] / c, 3),
            "avg_stress": round(v["stress_sum"] / c, 3),
        })

    Path("data/features").mkdir(parents=True, exist_ok=True)
    fieldnames = ["date", "events_count", "study_minutes", "exercise_minutes", "expense_amount", "avg_energy", "avg_focus", "avg_stress"]
    with open(OUTPUT_CSV, mode="w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    try:
        import pandas as pd
        pd.DataFrame(rows).to_parquet(OUTPUT_FILE, index=False)
        print(f"[daily_aggregator] Aggregated {len(rows)} days to {OUTPUT_FILE} & {OUTPUT_CSV} ✅")
    except ImportError:
        print(f"[daily_aggregator] Aggregated {len(rows)} days to {OUTPUT_CSV} ✅")

if __name__ == "__main__":
    aggregate()
