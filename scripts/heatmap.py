import os
from collections import defaultdict

log_file = "logs/learning-log.md"

if not os.path.exists(log_file):
    print("No logs available")
    exit()

activity = defaultdict(int)

with open(log_file) as f:
    lines = f.readlines()

for line in lines:

    if line.startswith("## "):
        date = line.replace("## ", "").strip()
        activity[date] += 1

os.makedirs("analytics", exist_ok=True)

output = "# Learning Activity Heatmap\n\n"

for date in sorted(activity.keys()):
    blocks = "█" * activity[date]
    output += f"{date} : {blocks}\n"

with open("analytics/heatmap.md", "w") as f:
    f.write(output)

print("Heatmap generated")