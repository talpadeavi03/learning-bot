import os
import requests
from datetime import datetime
import pytz

# Read secrets from GitHub Actions
token = os.environ["TELEGRAM_BOT_TOKEN"]

# Telegram API URL
url = f"https://api.telegram.org/bot{token}/getUpdates"

response = requests.get(url).json()

updates = response.get("result", [])

if len(updates) == 0:
    print("No Telegram messages found")
    exit()

latest = updates[-1]

update_id = latest["update_id"]
message = latest["message"]["text"]

# Ensure state directory exists
os.makedirs("state", exist_ok=True)

state_file = "state/last_update.txt"

# Create state file if missing
if not os.path.exists(state_file):
    with open(state_file, "w") as f:
        f.write("0")

# Read last processed update safely
with open(state_file, "r") as f:
    content = f.read().strip()

if content == "":
    last_update = 0
else:
    last_update = int(content)

# Skip if already processed
if update_id <= last_update:
    print("Message already logged")
    exit()

# Set IST timezone
tz = pytz.timezone("Asia/Kolkata")
now = datetime.now(tz)

date = now.strftime("%Y-%m-%d")
time = now.strftime("%H:%M")

entry = f"\n## {date}\n{time} | {message}\n"

# Ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# Append log
with open("logs/learning-log.md", "a") as f:
    f.write(entry)

# Save latest update id
with open(state_file, "w") as f:
    f.write(str(update_id))

print("New Telegram message logged successfully")