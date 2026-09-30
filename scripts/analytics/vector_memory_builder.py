import pandas as pd
import os
import json

INPUT = "data/processed/events_clean.csv"
VECTOR_INDEX = "data/vector/event_index.faiss"
META_FILE = "data/vector/event_metadata.json"

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

    os.makedirs("data/vector", exist_ok=True)
    with open(META_FILE, "w") as f:
        json.dump(metadata, f, indent=2)

    try:
        from sentence_transformers import SentenceTransformer
        import faiss
        import numpy as np

        model = SentenceTransformer("all-MiniLM-L6-v2")
        embeddings = model.encode(texts)
        dim = embeddings.shape[1]
        index = faiss.IndexFlatL2(dim)
        index.add(np.array(embeddings).astype("float32"))
        faiss.write_index(index, VECTOR_INDEX)
        print("[AETHER] Vector memory index (Faiss) built ✅")
    except Exception as e:
        print(f"[AETHER] Faiss/SentenceTransformers unavailable ({e}) — saved metadata memory only ✅")

    print(f"[AETHER] Memory records: {len(metadata)}")

if __name__ == "__main__":
    build_vector_memory()