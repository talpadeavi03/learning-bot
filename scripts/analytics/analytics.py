"""
analytics.py — High-Level Learning Dashboard Generator
Generates Markdown summary report in analytics/dashboard.md from events CSV or markdown log.
"""

import os
import csv
from pathlib import Path
from collections import Counter

LOG_MD = Path("logs/learning-log.md")
CSV_PROCESSED = Path("data/processed/events_clean.csv")
CSV_RAW = Path("data/raw/events.csv")
OUTPUT_FILE = Path("analytics/dashboard.md")

def main():
    topics = Counter()
    csv_file = CSV_PROCESSED if CSV_PROCESSED.exists() else (CSV_RAW if CSV_RAW.exists() else None)

    if csv_file:
        with open(csv_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                t = (row.get("topic") or "General").capitalize()
                topics[t] += 1
    elif LOG_MD.exists():
        with open(LOG_MD, encoding="utf-8") as f:
            lines = f.readlines()
        for line in lines:
            if "DO:" in line: topics["Devops"] += 1
            if "MO:" in line: topics["Mlops"] += 1
            if "PR:" in line: topics["Projects"] += 1
            if "IN:" in line: topics["Interview"] += 1
    else:
        print("[analytics] No log file or event data found.")
        return

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    lines = [
        "# Learning Dashboard",
        "",
        "## Weekly Learning Summary",
        ""
    ]
    for top, cnt in topics.most_common():
        lines.append(f"{top} Sessions: {cnt}\n")

    dashboard = "\n".join(lines)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(dashboard)

    print(f"[analytics] Dashboard generated -> {OUTPUT_FILE} ✅")

if __name__ == "__main__":
    main()