import os
import json
from collections import Counter
from datetime import datetime

LOG_FILE = "logs/learning-log.md"
OUTPUT_FILE = "site/data/dashboard.json"


if not os.path.exists(LOG_FILE):
    print("No logs found")
    exit()


topics = Counter()
daily_activity = Counter()

current_date = None


with open(LOG_FILE, encoding="utf-8") as f:
    lines = f.readlines()


for line in lines:

    line = line.strip()

    # Detect date sections
    if line.startswith("## "):
        try:
            current_date = line.replace("## ", "")
            datetime.strptime(current_date, "%Y-%m-%d")
        except Exception:
            current_date = None
        continue

    if not line:
        continue

    if current_date:
        daily_activity[current_date] += 1

    # Topic tagging
    if "DO:" in line:
        topics["DevOps"] += 1

    if "MO:" in line:
        topics["MLOps"] += 1

    if "PR:" in line:
        topics["Projects"] += 1

    if "IN:" in line:
        topics["Interview"] += 1


data = {
    "topics": dict(topics),
    "daily_activity": dict(daily_activity)
}


os.makedirs("site/data", exist_ok=True)

with open(OUTPUT_FILE, "w") as f:
    json.dump(data, f, indent=4)


print("Dashboard data generated:", OUTPUT_FILE)