"""
dashboard.py — Markdown Topic Distribution & ASCII Progress Bar
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
        print("[dashboard] No logs yet")
        return

    total = sum(topics.values())
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    dist_lines = []
    progress_lines = []
    for top, cnt in topics.most_common():
        dist_lines.append(f"{top}: {cnt}\n")
        blocks = "█" * min(cnt, 30)
        progress_lines.append(f"{top:<12}: {blocks}")

    dashboard = f"""# Learning Dashboard

## Total Study Sessions
{total}

## Topic Distribution

{"".join(dist_lines)}
---

## Progress Bar

{"\n".join(progress_lines)}
"""

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(dashboard)

    print(f"[dashboard] Dashboard generated -> {OUTPUT_FILE} ({total} sessions) ✅")

if __name__ == "__main__":
    main()