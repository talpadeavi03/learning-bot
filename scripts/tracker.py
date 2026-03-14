import json
import os

BATCH_FILE = "events.json"
LOG_FILE = "logs/learning-log.md"

if not os.path.exists(BATCH_FILE):
    print("No events.json found")
    exit()

with open(BATCH_FILE) as f:
    events = json.load(f)

os.makedirs("logs", exist_ok=True)

with open(LOG_FILE, "a") as log:

    for event in events:

        text = event.get("text")
        timestamp = event.get("timestamp")

        if not text:
            continue

        log.write(f"{timestamp} | {text}\n")

print(f"Logged {len(events)} messages")