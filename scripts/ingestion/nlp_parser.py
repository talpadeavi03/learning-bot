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

        # SPLIT MULTILINE MESSAGE
        messages = text.split("\n")

        for msg in messages:

            msg = msg.strip()

            if not msg:
                continue

            category = "general"
            topic = "general"

            text_lower = msg.lower()

            if any(word in text_lower for word in ["study","studied","learn","learning"]):
                category = "learning"

            elif any(word in text_lower for word in ["apply","job","interview"]):
                category = "career"

            elif any(word in text_lower for word in ["eat","food","diet"]):
                category = "health"

            elif any(word in text_lower for word in ["football","exercise","gym","run"]):
                category = "health"

            elif any(word in text_lower for word in ["spent","buy","bought","groceries"]):
                category = "finance"

            elif any(word in text_lower for word in ["python","coding","github","script"]):
                category = "project"

            writer.writerow([
                timestamp,
                user,
                msg,
                category,
                topic,
                "telegram"
            ])

print("Events parsed successfully")