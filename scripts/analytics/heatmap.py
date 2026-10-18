"""
heatmap.py — Learning Activity Heatmap Generator
Generates Markdown activity heatmap from events_clean.csv (or legacy learning-log.md).
"""

import os
import csv
from pathlib import Path
from collections import defaultdict

LOG_MD = Path("logs/learning-log.md")
CSV_PROCESSED = Path("data/processed/events_clean.csv")
CSV_RAW = Path("data/raw/events.csv")
OUTPUT_FILE = Path("analytics/heatmap.md")

def main():
    activity = defaultdict(int)

    # 1. Try modern CSV data first
    csv_file = CSV_PROCESSED if CSV_PROCESSED.exists() else (CSV_RAW if CSV_RAW.exists() else None)
    if csv_file:
        with open(csv_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts = row.get("timestamp", "")
                if len(ts) >= 10:
                    activity[ts[:10]] += 1
    elif LOG_MD.exists():
        with open(LOG_MD, encoding="utf-8") as f:
            for line in f:
                if line.startswith("## "):
                    d = line.replace("## ", "").strip()
                    activity[d] += 1
    else:
        print("[heatmap] No log file or event data found.")
        return

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    output = "# Learning Activity Heatmap\n\n"

    for date in sorted(activity.keys()):
        blocks = "█" * min(activity[date], 30)
        output += f"{date} ({activity[date]:>2}) : {blocks}\n"

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(output)

    print(f"[heatmap] Heatmap generated -> {OUTPUT_FILE} ({len(activity)} active days) ✅")

if __name__ == "__main__":
    main()