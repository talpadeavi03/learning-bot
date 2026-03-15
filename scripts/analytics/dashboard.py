import os
from collections import Counter

log_file = "logs/learning-log.md"

if not os.path.exists(log_file):
    print("No logs yet")
    exit()

topics = Counter()

with open(log_file) as f:
    lines = f.readlines()

for line in lines:

    if "DO:" in line:
        topics["DevOps"] += 1

    if "MO:" in line:
        topics["MLOps"] += 1

    if "PR:" in line:
        topics["Projects"] += 1

    if "IN:" in line:
        topics["Interview"] += 1


total = sum(topics.values())

dashboard = f"""
# Learning Dashboard

## Total Study Sessions
{total}

## Topic Distribution

DevOps: {topics['DevOps']}

MLOps: {topics['MLOps']}

Projects: {topics['Projects']}

Interview Prep: {topics['Interview']}

---

## Progress Bar

DevOps   : {'█'*topics['DevOps']}
MLOps    : {'█'*topics['MLOps']}
Projects : {'█'*topics['Projects']}
Interview: {'█'*topics['Interview']}
"""

os.makedirs("analytics", exist_ok=True)

with open("analytics/dashboard.md","w") as f:
    f.write(dashboard)

print("Dashboard updated")