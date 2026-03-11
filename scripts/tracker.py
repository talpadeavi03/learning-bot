import datetime
import os

now = datetime.datetime.now()
today = now.strftime("%Y-%m-%d %H:%M:%S")

# create logs folder if it doesn't exist
os.makedirs("logs", exist_ok=True)

entry = f"\n## {today}\nDO:test | MO:test | PR:test\n"

with open("logs/learning-log.md", "a") as f:
    f.write(entry)