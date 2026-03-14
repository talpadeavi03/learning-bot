import json
import csv
import os

BATCH_FILE = "events.json"
DATA_FILE = "data/events.csv"

if not os.path.exists(BATCH_FILE):
    print("No events.json found")
    exit()

with open(BATCH_FILE) as f:
    events = json.load(f)

os.makedirs("data", exist_ok=True)

file_exists = os.path.isfile(DATA_FILE)

with open(DATA_FILE, "a", newline="") as f:

    writer = csv.writer(f)

    if not file_exists:
        writer.writerow([
            "timestamp",
            "user",
            "text",
            "category",
            "topic"
        ])

    for event in events:

        text = event.get("text")
        user = event.get("user")
        timestamp = event.get("timestamp")

        if not text or not user or not timestamp:
            continue

        category = "general"
        topic = "general"

        text_lower = text.lower()

        if "study" in text_lower or "learn" in text_lower:
            category = "learning"

        elif "apply" in text_lower or "job" in text_lower:
            category = "career"

        elif "eat" in text_lower or "food" in text_lower:
            category = "health"

        elif "task" in text_lower:
            category = "task"

        elif "goal" in text_lower:
            category = "goal"

        writer.writerow([
            timestamp,
            user,
            text,
            category,
            topic
        ])

print(f"Parsed {len(events)} events")