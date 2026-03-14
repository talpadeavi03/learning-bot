import csv
import os
from datetime import datetime

EVENT_FILE = "data/events.csv"

text = os.environ.get("MSG_TEXT", "")
user = os.environ.get("MSG_USER", "unknown")
timestamp = os.environ.get("MSG_TIME", datetime.utcnow().isoformat())

text_lower = text.lower()

category = "learning"
topic = "general"

if "kubernetes" in text_lower:
    topic = "devops"

elif "terraform" in text_lower:
    topic = "iac"

elif "python" in text_lower:
    topic = "programming"

elif "ml" in text_lower:
    topic = "mlops"

row = [timestamp, user, text, category, topic]

file_exists = os.path.exists(EVENT_FILE)

with open(EVENT_FILE, "a", newline="") as f:
    writer = csv.writer(f)

    if not file_exists:
        writer.writerow(["timestamp", "user", "text", "category", "topic"])

    writer.writerow(row)

print("Event added to dataset")