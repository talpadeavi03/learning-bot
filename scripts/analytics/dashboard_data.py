import os
import json
from collections import Counter
from datetime import datetime

log_file = "logs/learning-log.md"

if not os.path.exists(log_file):
    print("No logs found")
    exit()

topics = Counter()
daily_activity = Counter()

current_date = None

with open(log_file) as f:
    lines = f.readlines()

for line in lines:

    line = line.strip()

    if line.startswith("## "):
        current_date = line.replace("## ", "")
        continue

    if not line:
        continue

    if current_date:
        daily_activity[current_date] += 1

    if "DO:" in line:
        topics["DevOps"] += 1

    if "MO:" in line:
        topics["MLOps"] += 1

    if "PR:" in line:
        topics["Projects"] += 1

    if "IN:" in line:
        topics["Interview"] += 1


data = {
    "topics": topics,
    "daily_activity": daily_activity
}

os.makedirs("site/data", exist_ok=True)

with open("site/data/dashboard.json", "w") as f:
    json.dump(data, f, indent=4)

print("Dashboard data generated")