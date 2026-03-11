import csv
import os
import re
from datetime import datetime

LOG_FILE = "logs/learning-log.md"
DATASET = "data/events.csv"

os.makedirs("data", exist_ok=True)

if not os.path.exists(DATASET):
    with open(DATASET, "w") as f:
        f.write("timestamp,type,value\n")

if not os.path.exists(LOG_FILE):
    print("No logs yet")
    exit()

# keyword detection rules
rules = {
    "task": ["apply", "resume", "interview", "job"],
    "study": ["study", "learn", "reading", "course"],
    "health": ["water", "drink", "sleep", "gym"],
    "mood": ["feel", "feeling", "happy", "tired"],
    "goal": ["goal", "target", "finish"],
    "progress": ["completed", "done", "finished"]
}

events = []

with open(LOG_FILE) as f:
    lines = f.readlines()

timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

for line in lines:

    text = line.strip().lower()

    if not text or text.startswith("#"):
        continue

    for event_type, keywords in rules.items():

        for keyword in keywords:

            if keyword in text:

                events.append((timestamp, event_type, text))
                break

# remove duplicates
events = list(set(events))

if not events:
    print("No events detected")
    exit()

with open(DATASET, "a", newline="") as f:

    writer = csv.writer(f)

    for e in events:
        writer.writerow(e)

print("events dataset updated")