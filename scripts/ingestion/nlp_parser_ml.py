from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
import pandas as pd

INPUT_FILE = "data/raw/events.csv"
OUTPUT_FILE = "data/processed/events_ml.csv"

model = SentenceTransformer("all-MiniLM-L6-v2")

categories = {
    "learning": [
        "studying programming",
        "learning new technology",
        "reading technical material"
    ],
    "health": [
        "eating food",
        "feeling tired",
        "exercise and physical health"
    ],
    "emotion": [
        "feeling happy",
        "feeling stressed",
        "mental state"
    ],
    "productivity": [
        "doing tasks",
        "working deeply",
        "focused work"
    ],
    "finance": [
        "spending money",
        "buying groceries",
        "financial expenses"
    ]
}

category_embeddings = {
    cat: model.encode(descs)
    for cat, descs in categories.items()
}

df = pd.read_csv(INPUT_FILE)

rows = []

for _, row in df.iterrows():

    text = str(row["value"])

    embedding = model.encode([text])

    best_category = "general"
    best_score = 0

    for cat, embeds in category_embeddings.items():

        sim = cosine_similarity(embedding, embeds).max()

        if sim > best_score:
            best_score = sim
            best_category = cat

    rows.append({
        "timestamp": row["timestamp"],
        "text": text,
        "category": best_category,
        "score": best_score
    })

result = pd.DataFrame(rows)

result.to_csv(OUTPUT_FILE, index=False)

print("AI semantic parsing complete")