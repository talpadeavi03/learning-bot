import csv
import re
from datetime import datetime

log_file = "logs/learning-log.md"
events_file = "data/events.csv"

rules = {
    "task": ["apply", "applied", "resume", "interview", "job"],
    "study": ["study", "studied", "learn", "learning", "course", "reading"],
    "health": ["water", "drink", "drank", "sleep", "gym"],
    "mood": ["feel", "feeling", "happy", "tired", "productive"],
    "goal": ["goal", "target", "finish"],
    "progress": ["completed", "done", "finished"]
}

def classify(sentence):
    s = sentence.lower()
    for category, keywords in rules.items():
        for word in keywords:
            if word in s:
                return category
    return None


events = []

with open(log_file, "r") as f:
    lines = f.readlines()

for line in lines:

    if "|" not in line:
        continue

    parts = line.split("|", 1)
    text = parts[1].strip()

    sentences = re.split(r'[.!?]', text)

    for s in sentences:

        s = s.strip()

        if not s:
            continue

        category = classify(s)

        if category:
            events.append([
                datetime.now().strftime("%Y-%m-%d"),
                category,
                s
            ])


with open(events_file, "w", newline="") as f:

    writer = csv.writer(f)
    writer.writerow(["timestamp", "type", "value"])

    for e in events:
        writer.writerow(e)

print("events parsed:", len(events))