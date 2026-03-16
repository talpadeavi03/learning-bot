import csv
import os
import json

INPUT_FILE = "events.json"
DATA_FILE = "data/raw/events.csv"

EXPECTED_COLUMNS = [
    "timestamp",
    "user",
    "text",
    "category",
    "topic",
    "source"
]

if not os.path.exists(INPUT_FILE):
    print("No events.json found")
    exit()

with open(INPUT_FILE, encoding="utf-8") as f:
    events = json.load(f)

os.makedirs("data/raw", exist_ok=True)

file_exists = os.path.isfile(DATA_FILE)

with open(DATA_FILE, "a", newline="", encoding="utf-8") as f:

    writer = csv.writer(f, quoting=csv.QUOTE_ALL)

    # Write header once
    if not file_exists:
        writer.writerow(EXPECTED_COLUMNS)

    for event in events:

        timestamp = event.get("timestamp")
        user = event.get("user")
        text = event.get("text")

        if not timestamp or not text:
            continue

        # Split multiline messages
        messages = text.split("\n")

        for msg in messages:

            msg = msg.strip()

            if not msg:
                continue

            text_lower = msg.lower()

            category = "general"
            topic = "general"

            # CATEGORY DETECTION
            if any(w in text_lower for w in ["study","studied","learn","learning"]):
                category = "learning"

            elif any(w in text_lower for w in ["apply","job","interview"]):
                category = "career"

            elif any(w in text_lower for w in ["eat","food","diet","gym","run","exercise"]):
                category = "health"

            elif any(w in text_lower for w in ["spent","buy","bought","groceries"]):
                category = "finance"

            elif any(w in text_lower for w in ["python","coding","github","script"]):
                category = "project"

            # TOPIC DETECTION
            topics = ["kubernetes","python","ml","mlops","docker","linux","devops"]

            for t in topics:
                if t in text_lower:
                    topic = t
                    break

            writer.writerow([
                timestamp,
                user,
                msg,
                category,
                topic,
                "telegram"
            ])

print("Events parsed successfully")