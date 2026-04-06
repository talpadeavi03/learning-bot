from scripts.db.supabase_client import supabase


def calculate_stats(events):
    stats = {
        "STR": 0,
        "INT": 0,
        "VIT": 0,
        "AGI": 0,
        "SEN": 0
    }

    xp = 0

    for e in events:
        impact = e.get("stat_impact") or {}

        for k, v in impact.items():
            if k in stats:
                stats[k] += v
                xp += v * 10

    return stats, xp


def update_state_db(user_id, stats, xp):
    level = int(xp / 100) + 1

    supabase.table("state").upsert({
        "user_id": user_id,
        "xp": xp,
        "level": level,
        "str": stats["STR"],
        "int_stat": stats["INT"],
        "vit": stats["VIT"],
        "agi": stats["AGI"],
        "sen": stats["SEN"]
    }).execute()


def run_state_update():
    events = supabase.table("events") \
        .select("*") \
        .eq("user_id", "talpadeavi03") \
        .execute().data

    print(f"Found {len(events)} events")

    stats, xp = calculate_stats(events)

    print("Stats:", stats)
    print("XP:", xp)

    update_state_db("avi_001", stats, xp)

    print("State updated successfully")


if __name__ == "__main__":
    run_state_update()