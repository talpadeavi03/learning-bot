import csv
import os
import json

INPUT_FILE = "events.json"
DATA_FILE = "data/raw/events.csv"

if not os.path.exists(INPUT_FILE):
    print("No events.json found")
    exit()

with open(INPUT_FILE) as f:
    events = json.load(f)

os.makedirs("data/raw", exist_ok=True)

file_exists = os.path.isfile(DATA_FILE)

with open(DATA_FILE, "a", newline="", encoding="utf-8") as f:

    writer = csv.writer(f)

    # write header if file doesn't exist
    if not file_exists:
        writer.writerow([
            "timestamp",
            "user",
            "text",
            "category",
            "topic",
            "source"
        ])

    for event in events:

        timestamp = event.get("timestamp")
        user = event.get("user")
        text = event.get("text")

        if not timestamp or not text:
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

        elif "football" in text_lower or "exercise" in text_lower:
            category = "health"

        elif "spent" in text_lower or "buy" in text_lower:
            category = "finance"

        writer.writerow([
            timestamp,
            user,
            text,
            category,
            topic,
            "telegram"
        ])

print("Events parsed successfully")