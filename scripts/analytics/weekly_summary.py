import os
from collections import Counter
from datetime import datetime, timedelta

log_file = "logs/learning-log.md"

if not os.path.exists(log_file):
    print("No logs available")
    exit()

# Read log lines
with open(log_file) as f:
    lines = f.readlines()

topics = Counter()
recent_messages = []

today = datetime.now()
week_ago = today - timedelta(days=7)

current_date = None

for line in lines:

    line = line.strip()

    if line.startswith("## "):
        try:
            current_date = datetime.strptime(line.replace("## ", ""), "%Y-%m-%d")
        except:
            current_date = None
        continue

    if not line:
        continue

    if current_date and current_date >= week_ago:

        recent_messages.append(line)

        if "DO:" in line:
            topics["DevOps"] += 1

        if "MO:" in line:
            topics["MLOps"] += 1

        if "PR:" in line:
            topics["Projects"] += 1

        if "IN:" in line:
            topics["Interview"] += 1


total_sessions = sum(topics.values())

report = f"""
# 📅 Weekly Learning Summary

## 🚀 Overview
Total Study Sessions: **{total_sessions}**

---

## 📚 Topics Covered

| Category | Sessions |
|---------|----------|
| ⚙ DevOps | {topics['DevOps']} |
| 🤖 MLOps | {topics['MLOps']} |
| 🚀 Projects | {topics['Projects']} |
| 🎯 Interview Prep | {topics['Interview']} |

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

os.makedirs("analytics", exist_ok=True)

with open("analytics/weekly-summary.md", "w") as f:
    f.write(report)

print("Weekly summary generated")