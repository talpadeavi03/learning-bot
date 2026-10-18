"""
weekly_summary.py — Weekly Learning Summary Report
Generates Markdown summary report in analytics/weekly-summary.md from events CSV or markdown log.
"""

import os
import csv
from pathlib import Path
from collections import Counter
from datetime import datetime, timedelta, timezone

LOG_MD = Path("logs/learning-log.md")
CSV_PROCESSED = Path("data/processed/events_clean.csv")
CSV_RAW = Path("data/raw/events.csv")
OUTPUT_FILE = Path("analytics/weekly-summary.md")

def main():
    topics = Counter()
    recent_messages = []
    total_sessions = 0

    csv_file = CSV_PROCESSED if CSV_PROCESSED.exists() else (CSV_RAW if CSV_RAW.exists() else None)

    if csv_file:
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)
        with open(csv_file, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                ts_str = row.get("timestamp", "")
                try:
                    dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
                except:
                    dt = datetime.now(timezone.utc)

                topic = (row.get("topic") or "General").capitalize()
                raw = row.get("raw_text") or row.get("summary") or "Learning session"

                if dt >= cutoff or len(recent_messages) < 10:
                    topics[topic] += 1
                    total_sessions += 1
                    recent_messages.append(f"{dt.strftime('%b %d')}: {raw}")
    elif LOG_MD.exists():
        with open(LOG_MD, encoding="utf-8") as f:
            lines = f.readlines()
        week_ago = datetime.now() - timedelta(days=7)
        current_date = None
        for line in lines:
            line = line.strip()
            if line.startswith("## "):
                try:
                    current_date = datetime.strptime(line.replace("## ", ""), "%Y-%m-%d")
                except:
                    current_date = None
                continue
            if current_date and current_date >= week_ago:
                recent_messages.append(line)
                if "DO:" in line: topics["DevOps"] += 1
                if "MO:" in line: topics["MLOps"] += 1
                if "PR:" in line: topics["Projects"] += 1
                if "IN:" in line: topics["Interview"] += 1
        total_sessions = sum(topics.values())
    else:
        print("[weekly_summary] No log file or event data found.")
        return

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)

    topic_rows = ""
    for top, cnt in topics.most_common():
        topic_rows += f"| {top} | {cnt} |\n"

    report = f"""# 📅 Weekly Learning Summary

## 🚀 Overview
Total Study Sessions: **{total_sessions}**

---

## 📚 Topics Covered

| Category | Sessions |
|---------|----------|
{topic_rows}
---

## 🧠 Key Learning Activities

"""
    for msg in recent_messages[-10:]:
        report += f"- {msg}\n"

    report += """
---

## 📈 Productivity Insight

Great progress this week! Keep maintaining consistent daily learning.
"""

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        f.write(report)

    print(f"[weekly_summary] Weekly summary generated -> {OUTPUT_FILE} ({total_sessions} sessions) ✅")

if __name__ == "__main__":
    main()