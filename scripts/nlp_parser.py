import json
import csv
import os

BATCH_FILE = "events.json"
DATA_FILE = "data/events.csv"

# Stop if no batch file
if not os.path.exists(BATCH_FILE):
    print("No events.json found")
    exit()

# Load events
with open(BATCH_FILE) as f:
    events = json.load(f)

# Ensure data folder exists
os.makedirs("data", exist_ok=True)

# Check if CSV already exists
file_exists = os.path.isfile(DATA_FILE)

with open(DATA_FILE, "a", newline="", encoding="utf-8") as f:

    writer = csv.writer(f)

    # Write header if file is new
    if not file_exists:
        writer.writerow([
            "timestamp",
            "user",
            "text",
            "category",
            "topic"
        ])

    parsed_count = 0

    for event in events:

        text = event.get("text")
        user = event.get("user")
        timestamp = event.get("timestamp")

        # Skip invalid events
        if not text or not user or not timestamp:
            print("Skipping invalid event:", event)
            continue

        category = "general"
        topic = "general"

        text_lower = text.lower()

        # Simple classification
        if "study" in text_lower or "learn" in text_lower:
            category = "learning"

        elif "apply" in text_lower or "job" in text_lower:
            category = "career"

        elif "eat" in text_lower or "food" in text_lower:
            category = "health"

        elif "task" in text_lower or "do:" in text_lower:
            category = "task"

        elif "goal" in text_lower:
            category = "goal"

        writer.writerow([
            timestamp,
            user,
            text.strip(),
            category,
            topic
        ])

        parsed_count += 1

print(f"Parsed {parsed_count} valid events")