import pandas as pd
import os
import json
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

INPUT = "data/processed/events_clean.csv"
VECTOR_INDEX = "data/vector/event_index.faiss"
META_FILE = "data/vector/event_metadata.json"

model = SentenceTransformer("all-MiniLM-L6-v2")

def build_vector_memory():

    if not os.path.exists(INPUT):
        print("[AETHER] No dataset found")
        return

    df = pd.read_csv(INPUT)

    print(f"[AETHER] Loaded {len(df)} events")

    texts = []

    metadata = []

    for _, row in df.iterrows():

        text = str(row.get("raw_text", row.get("text", "")))

        texts.append(text)

        metadata.append({
            "timestamp": row.get("timestamp"),
            "topic": row.get("topic"),
            "text": text
        })

    embeddings = model.encode(texts)

    dim = embeddings.shape[1]

    index = faiss.IndexFlatL2(dim)

    index.add(np.array(embeddings).astype("float32"))

    os.makedirs("data/vector", exist_ok=True)

    faiss.write_index(index, VECTOR_INDEX)

    with open(META_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    print("[AETHER] Vector memory built")
    print(f"[AETHER] Vectors: {len(metadata)}")

if __name__ == "__main__":
    build_vector_memory()