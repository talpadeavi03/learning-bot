from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

from scripts.db.supabase_client import supabase

# load model once
model = SentenceTransformer("all-MiniLM-L6-v2")

categories = {
    "learning": ["studying programming", "learning new technology"],
    "health": ["exercise", "tired", "food"],
    "emotion": ["happy", "stressed"],
    "productivity": ["working", "focused work"],
    "finance": ["spending money", "expenses"]
}

category_embeddings = {
    cat: model.encode(descs)
    for cat, descs in categories.items()
}

def update_event(event_id, updates):
    supabase.table("events") \
        .update(updates) \
        .eq("id", event_id) \
        .execute()

def get_ml_category(text):
    embedding = model.encode([text])

    best_category = "general"
    best_score = 0

    for cat, embeds in category_embeddings.items():
        sim = cosine_similarity(embedding, embeds).max()

        if sim > best_score:
            best_score = sim
            best_category = cat

    return best_category, float(best_score)

def process_events():
    events = supabase.table("events") \
        .select("*") \
        .eq("processed", False) \
        .execute().data

    print(f"Found {len(events)} events")

    for e in events:
        text = e["input_text"].lower()
        updates = {}

        # RULES
        if "work" in text or "project" in text:
            updates["life_dimension"] = "career"
            updates["stat_impact"] = {"INT": 2}

        elif "football" in text or "exercise" in text:
            updates["life_dimension"] = "fitness"
            updates["stat_impact"] = {"STR": 3}

        else:
            cat, score = get_ml_category(text)
            updates["life_dimension"] = cat
            updates["confidence"] = score

        # SIGNALS
        if "stressed" in text:
            updates["stress_signal"] = 0.8

        if "focused" in text:
            updates["focus_signal"] = 0.9

        updates["processed"] = True

        print("Updating:", updates)

        update_event(e["id"], updates)

if __name__ == "__main__":
    process_events()