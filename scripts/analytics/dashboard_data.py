"""
dashboard_data.py — Dashboard Topic & Activity Aggregator
Extracts learning topics and activity streaks from events.csv and merges
into site/data/dashboard.json without overwriting ML predictions.
"""

import os
import json
import csv
from collections import Counter
from pathlib import Path

OUTPUT_FILE = "site/data/dashboard.json"

def process():
    target_csv = None
    for p in ["data/processed/events_clean.csv", "data/raw/events.csv"]:
        if os.path.exists(p):
            target_csv = p
            break

    topics = Counter()
    daily_activity = Counter()

    if target_csv:
        with open(target_csv, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for r in reader:
                ts = r.get("timestamp", "")
                if ts and len(ts) >= 10:
                    d = ts[:10]
                    daily_activity[d] += 1
                
                t = r.get("topic") or ""
                if t:
                    topics[t.capitalize()] += 1
                else:
                    text = (r.get("raw_text") or "").lower()
                    if "mlops" in text: topics["MLOps"] += 1
                    elif "python" in text: topics["Python"] += 1
                    elif "docker" in text: topics["Docker"] += 1
                    elif "kubernetes" in text: topics["Kubernetes"] += 1
                    elif "devops" in text: topics["DevOps"] += 1

    # Check secondary markdown log if it exists
    log_file = "logs/learning-log.md"
    if os.path.exists(log_file):
        with open(log_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if "DO:" in line: topics["DevOps"] += 1
                elif "MO:" in line: topics["MLOps"] += 1
                elif "PR:" in line: topics["Projects"] += 1
                elif "IN:" in line: topics["Interview"] += 1

    # Load existing dashboard predictions
    dashboard = {}
    if os.path.exists(OUTPUT_FILE):
        try:
            with open(OUTPUT_FILE, "r", encoding="utf-8") as f:
                dashboard = json.load(f)
        except Exception:
            dashboard = {}

    dashboard["topics"] = dict(topics.most_common(8))
    dashboard["daily_activity"] = dict(daily_activity)
    dashboard["total_events_logged"] = sum(daily_activity.values())

    Path(OUTPUT_FILE).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, indent=2)

    print(f"[dashboard_data] Aggregated {len(topics)} topics across {len(daily_activity)} active days -> {OUTPUT_FILE} ✅")

if __name__ == "__main__":
    process()
