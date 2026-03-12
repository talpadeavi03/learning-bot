import csv
import re
from datetime import datetime
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

log_file = "logs/learning-log.md"
events_file = "data/events.csv"

# semantic categories
categories = [
    "task",
    "study",
    "health",
    "mood",
    "goal",
    "progress"
]

model = SentenceTransformer("all-MiniLM-L6-v2")

category_embeddings = model.encode(categories)


def classify(sentence):
    embedding = model.encode([sentence])
    scores = cosine_similarity(embedding, category_embeddings)
    index = scores.argmax()
    return categories[index]


events = []

with open(log_file, "r") as f:
    lines = f.readlines()

for line in lines:

    if "|" not in line:
        continue

    text = line.split("|", 1)[1].strip()

    sentences = re.split(r"[.!?]", text)

    for s in sentences:

        s = s.strip()

        if not s:
            continue

        category = classify(s)

        events.append([
            datetime.now().strftime("%Y-%m-%d"),
            category,
            s
        ])

with open(events_file, "w", newline="") as f:

    writer = csv.writer(f)
    writer.writerow(["timestamp", "type", "value"])

    for e in events:
        writer.writerow(e)

print("events parsed:", len(events))