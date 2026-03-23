import faiss
import json
import numpy as np
from sentence_transformers import SentenceTransformer

INDEX_PATH = "data/vector/event_index.faiss"
META_PATH = "data/vector/event_metadata.json"

model = SentenceTransformer("all-MiniLM-L6-v2")


def search(query, top_k=5):

    index = faiss.read_index(INDEX_PATH)

    with open(META_PATH) as f:
        metadata = json.load(f)

    q_vec = model.encode([query]).astype("float32")

    D, I = index.search(q_vec, top_k)

    results = []

    for idx in I[0]:
        if idx < len(metadata):
            results.append(metadata[idx])

    return results


if __name__ == "__main__":

    q = input("Query: ")

    results = search(q)

    print("\nResults:\n")

    for r in results:
        print(r)