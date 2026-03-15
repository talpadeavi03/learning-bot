import os
from collections import Counter

log_file = "logs/learning-log.md"

if not os.path.exists(log_file):
    print("No log file found")
    exit()

devops = 0
mlops = 0
projects = 0
interview = 0

with open(log_file) as f:
    lines = f.readlines()

for line in lines:
    if "DO:" in line:
        devops += 1
    if "MO:" in line:
        mlops += 1
    if "PR:" in line:
        projects += 1
    if "IN:" in line:
        interview += 1

dashboard = f"""
# Learning Dashboard

## Weekly Learning Summary

DevOps Topics Learned: {devops}

MLOps Experiments: {mlops}

Projects Worked On: {projects}

Interview Preparation: {interview}
"""

os.makedirs("analytics", exist_ok=True)

with open("analytics/dashboard.md", "w") as f:
    f.write(dashboard)

print("Dashboard generated")