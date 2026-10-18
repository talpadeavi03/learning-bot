"""
nlp_parser_old.py — Legacy semantic classification helper for Supabase events
"""

import sys
from pathlib import Path

# Add project root to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

categories = {
    "learning": ["studying programming", "learning new technology"],
    "health": ["exercise", "tired", "food"],
    "emotion": ["happy", "stressed"],
    "productivity": ["working", "focused work"],
    "finance": ["spending money", "expenses"]
}

_model = None
_category_embeddings = None

def _get_model():
    global _model, _category_embeddings
    if _model is None:
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer("all-MiniLM-L6-v2")
            _category_embeddings = {
                cat: _model.encode(descs)
                for cat, descs in categories.items()
            }
        except Exception:
            _model = False
    return _model

def get_ml_category(text):
    model = _get_model()
    if model:
        try:
            from sklearn.metrics.pairwise import cosine_similarity
            embedding = model.encode([text])
            best_category = "general"
            best_score = 0
            for cat, embeds in _category_embeddings.items():
                sim = float(cosine_similarity(embedding, embeds).max())
                if sim > best_score:
                    best_score = sim
                    best_category = cat
            return best_category, float(best_score)
        except Exception:
            pass

    # Heuristic fallback
    lower = text.lower()
    for cat, kws in categories.items():
        if any(w in lower for w in kws):
            return cat, 0.75
    return "general", 0.3

def update_event(event_id, updates):
    try:
        from scripts.db.supabase_client import get_client
        client = get_client()
        client.table("events").update(updates).eq("id", event_id).execute()
    except Exception as e:
        print(f"[nlp_parser_old] Supabase update skipped: {e}")

def process_events():
    try:
        from scripts.db.supabase_client import get_client
        client = get_client()
        events = client.table("events").select("*").eq("processed", False).execute().data
    except Exception as e:
        print(f"[nlp_parser_old] Supabase fetch skipped: {e}")
        return

    print(f"Found {len(events)} events")

    for e in events:
        text = (e.get("input_text") or e.get("raw_text") or "").lower()
        updates = {}

        if "work" in text or "project" in text:
            updates["life_dimension"] = "career"
            updates["stat_impact"] = {"INT": 2}
        elif "football" in text or "exercise" in text:
            updates["life_dimension"] = "fitness"
            updates["stat_impact"] = {"STR": 2}
        elif "study" in text:
            updates["life_dimension"] = "study"
            updates["stat_impact"] = {"INT": 3}

        cat, score = get_ml_category(text)
        updates["ml_category"] = cat
        updates["processed"] = True

        if e.get("id"):
            update_event(e["id"], updates)

if __name__ == "__main__":
    process_events()