import datetime

log = "DO:k8s service | MO:mlflow run | PR:job parser"

today = datetime.date.today()

entry = f"\n## {today}\n{log}\n"

with open("logs/learning-log.md","a") as f:
    f.write(entry)