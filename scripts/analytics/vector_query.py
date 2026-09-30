import os
import json

INDEX_PATH = "data/vector/event_index.faiss"
META_PATH = "data/vector/event_metadata.json"

def search(query, top_k=5):
    # Try Faiss & SentenceTransformer if available and index exists
    try:
        import faiss
        import numpy as np
        from sentence_transformers import SentenceTransformer
        if os.path.exists(INDEX_PATH) and os.path.exists(META_PATH):
            model = SentenceTransformer("all-MiniLM-L6-v2")
            index = faiss.read_index(INDEX_PATH)
            with open(META_PATH) as f:
                metadata = json.load(f)
            q_vec = model.encode([query]).astype("float32")
            D, I = index.search(q_vec, top_k)
            results = []
            for idx in I[0]:
                if 0 <= idx < len(metadata):
                    results.append(metadata[idx])
            return results
    except Exception:
        pass

    # Lightweight keyword / topic search fallback
    results = []
    if os.path.exists(META_PATH):
        try:
            with open(META_PATH) as f:
                metadata = json.load(f)
            q_words = set(query.lower().split())
            scored = []
            for item in metadata:
                text = item.get("text", "").lower()
                topic = item.get("topic", "").lower()
                item_words = set((text + " " + topic).split())
                overlap = len(q_words & item_words)
                if overlap > 0:
                    scored.append((overlap, item))
            scored.sort(key=lambda x: x[0], reverse=True)
            results = [item for _, item in scored[:top_k]]
        except Exception:
            pass
    return results


if __name__ == "__main__":
    import sys
    q = sys.argv[1] if len(sys.argv) > 1 else input("Query: ")

    results = search(q)

    print("\nResults:\n")

    for r in results:
        print(r)