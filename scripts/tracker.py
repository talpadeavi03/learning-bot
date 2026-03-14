import os
import datetime

text = os.environ.get("MSG_TEXT")
user = os.environ.get("MSG_USER", "unknown")
timestamp = os.environ.get("MSG_TIME")

if not text:
    print("No message received")
    exit()

if not timestamp:
    timestamp = datetime.datetime.utcnow().isoformat()

entry = f"- {timestamp} | {text}\n"

os.makedirs("logs", exist_ok=True)

with open("logs/learning-log.md", "a") as f:
    f.write(entry)

print("Logged:", text)