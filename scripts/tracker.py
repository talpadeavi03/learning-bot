import os
import requests
from datetime import datetime
import pytz

token = os.environ["TELEGRAM_BOT_TOKEN"]

url = f"https://api.telegram.org/bot{token}/getUpdates"

data = requests.get(url).json()

updates = data.get("result", [])

if len(updates) == 0:
    print("No messages found")
    exit()

latest = updates[-1]

update_id = latest["update_id"]
message = latest["message"]["text"]

# read last processed update
os.makedirs("state", exist_ok=True)

state_file = "state/last_update.txt"

if not os.path.exists(state_file):
    with open(state_file, "w") as f:
        f.write("0")

with open(state_file, "r") as f:
    last_update = int(f.read().strip())

if update_id <= last_update:
    print("Message already logged")
    exit()

# timezone IST
tz = pytz.timezone("Asia/Kolkata")
now = datetime.now(tz)

date = now.strftime("%Y-%m-%d")
time = now.strftime("%H:%M")

entry = f"\n## {date}\n{time} | {message}\n"

os.makedirs("logs", exist_ok=True)

with open("logs/learning-log.md", "a") as f:
    f.write(entry)

# update state
with open(state_file, "w") as f:
    f.write(str(update_id))

print("New message logged")