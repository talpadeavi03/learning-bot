import os
import requests
from datetime import datetime
import pytz

# read secrets
token = os.environ["TELEGRAM_BOT_TOKEN"]
chat_id = os.environ["TELEGRAM_CHAT_ID"]

# telegram api
url = f"https://api.telegram.org/bot{token}/getUpdates"

response = requests.get(url).json()

if "result" not in response or len(response["result"]) == 0:
    print("No messages found")
    exit()

# latest message
message = response["result"][-1]["message"]["text"]

# timezone IST
tz = pytz.timezone("Asia/Kolkata")
now = datetime.now(tz)

date = now.strftime("%Y-%m-%d")
time = now.strftime("%H:%M")

# log entry
entry = f"\n## {date}\n{time} | {message}\n"

# ensure logs directory exists
os.makedirs("logs", exist_ok=True)

# write log
with open("logs/learning-log.md", "a") as f:
    f.write(entry)

print("Log updated successfully")