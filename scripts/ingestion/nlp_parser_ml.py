"""
nlp_parser_ml.py — Semantic Category Classification
Uses SentenceTransformer (or scikit-learn TF-IDF fallback) to classify events into semantic categories.
"""

import os
from pathlib import Path
import pandas as pd

INPUT_FILE = Path("data/processed/events_clean.csv")
if not INPUT_FILE.exists():
    INPUT_FILE = Path("data/raw/events.csv")
OUTPUT_FILE = Path("data/processed/events_ml.csv")

categories = {
    "learning": [
        "studying programming",
        "learning new technology",
        "reading technical material",
        "coding building practice"
    ],
    "health": [
        "eating food",
        "feeling tired",
        "exercise and physical health",
        "workout gym run walk"
    ],
    "emotion": [
        "feeling happy",
        "feeling stressed",
        "mental state",
        "anxiety recovery calm"
    ],
    "productivity": [
        "doing tasks",
        "working deeply",
        "focused work",
        "shipping features bug fixes"
    ],
    "finance": [
        "spending money",
        "buying groceries",
        "financial expenses",
        "budget salary"
    ]
}

def main():
    if not INPUT_FILE.exists():
        print(f"[nlp_parser_ml] Input file {INPUT_FILE} not found.")
        return

    df = pd.read_csv(INPUT_FILE)
    if df.empty:
        print("[nlp_parser_ml] Input file is empty.")
        return

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    rows = []

    # Check for SentenceTransformer
    use_st = False
    try:
        from sentence_transformers import SentenceTransformer
        from sklearn.metrics.pairwise import cosine_similarity
        model = SentenceTransformer("all-MiniLM-L6-v2")
        category_embeddings = {
            cat: model.encode(descs)
            for cat, descs in categories.items()
        }
        use_st = True
        print("[nlp_parser_ml] Using SentenceTransformer semantic embeddings.")
    except Exception:
        print("[nlp_parser_ml] SentenceTransformer not installed — using TF-IDF cosine similarity fallback.")
        from sklearn.feature_extraction.text import TfidfVectorizer
        from sklearn.metrics.pairwise import cosine_similarity
        corpus = []
        cat_keys = list(categories.keys())
        for cat in cat_keys:
            corpus.append(" ".join(categories[cat]))
        vectorizer = TfidfVectorizer().fit(corpus)
        cat_vectors = {cat: vectorizer.transform([" ".join(categories[cat])]) for cat in cat_keys}

    for _, row in df.iterrows():
        text = str(row.get("raw_text") or row.get("text") or row.get("value") or "")
        if not text.strip():
            continue

        best_category = "general"
        best_score = 0.0

        if use_st:
            embedding = model.encode([text])
            for cat, embeds in category_embeddings.items():
                sim = float(cosine_similarity(embedding, embeds).max())
                if sim > best_score:
                    best_score = sim
                    best_category = cat
        else:
            text_vec = vectorizer.transform([text])
            for cat, c_vec in cat_vectors.items():
                sim = float(cosine_similarity(text_vec, c_vec)[0][0])
                if sim > best_score:
                    best_score = sim
                    best_category = cat

        rows.append({
            "timestamp": row.get("timestamp", ""),
            "text": text,
            "category": best_category if best_score > 0.1 else "general",
            "score": round(best_score, 3)
        })

    result = pd.DataFrame(rows)
    result.to_csv(OUTPUT_FILE, index=False)
    print(f"[nlp_parser_ml] AI semantic parsing complete -> {OUTPUT_FILE} ({len(rows)} events) ✅")

if __name__ == "__main__":
    main()