import csv
import os
import json
import re

INPUT_FILE = "events.json"
DATA_FILE = "data/raw/events.csv"

if not os.path.exists(INPUT_FILE):
    print("No events.json found")
    exit()

with open(INPUT_FILE) as f:
    events = json.load(f)

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

        # Split multiline Telegram messages
        lines = text.split("\n")

        for line in lines:

            line = line.strip()

            if not line:
                continue

            # Remove numbering like "1 ", "2 "
            line = re.sub(r'^\d+\s+', '', line)

            category = "general"
            topic = "general"

            text_lower = line.lower()

            if "study" in text_lower or "learn" in text_lower:
                category = "learning"

            elif "football" in text_lower or "ride" in text_lower or "exercise" in text_lower:
                category = "health"

            elif "spent" in text_lower or "bought" in text_lower:
                category = "finance"

            elif "workflow" in text_lower or "pipeline" in text_lower:
                category = "project"

            with open(DATA_FILE, "a", newline="", encoding="utf-8") as f:

print("Events parsed successfully")