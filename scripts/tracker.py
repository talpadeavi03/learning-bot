import os
import datetime

text = os.environ.get("TELEGRAM_TEXT")

if not text:
    print("No message received")
    exit()

now = datetime.datetime.now().strftime("%H:%M")

entry = f"\n{now} | {text}\n"

os.makedirs("logs", exist_ok=True)

with open("logs/learning-log.md", "a") as f:
    f.write(entry)

print("Logged:", text)
