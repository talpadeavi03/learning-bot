import pandas as pd
import json
import os

INPUT = "data/processed/events_clean.csv"
OUTPUT = "site/data/patterns.json"

def detect_patterns():

    if not os.path.exists(INPUT):
        print("[AETHER] No dataset found")
        return

    df = pd.read_csv(INPUT)

    print(f"[AETHER] Loaded {len(df)} events")

    patterns = []

    # --------------------------------
    # Peak productivity hour
    # --------------------------------

    if "hour_utc" in df.columns and "energy_signal" in df.columns:

        hourly = df.groupby("hour_utc")["energy_signal"].mean()

        peak_hour = hourly.idxmax()

        patterns.append({
            "type": "peak_hour",
            "hour": int(peak_hour),
            "description": f"Energy peaks around {peak_hour}:00 UTC"
        })


    # --------------------------------
    # Stress patterns
    # --------------------------------

    if "stress_signal" in df.columns:

        avg_stress = df["stress_signal"].mean()

        patterns.append({
            "type": "stress_level",
            "value": float(avg_stress),
            "description": f"Average stress level {round(avg_stress*100)}%"
        })


    # --------------------------------
    # Study session correlation
    # --------------------------------

    if "is_study_session" in df.columns:

        study = df[df["is_study_session"] == True]

        if len(study) > 0:

            focus = study["focus_signal"].mean()

            patterns.append({
                "type": "study_focus",
                "value": float(focus),
                "description": f"Study sessions produce {round(focus*100)}% focus"
            })


    # --------------------------------
    # Weekend vs weekday productivity
    # --------------------------------

    if "is_weekend" in df.columns:

        weekend = df[df["is_weekend"] == True]["energy_signal"].mean()
        weekday = df[df["is_weekend"] == False]["energy_signal"].mean()

        patterns.append({
            "type": "weekend_vs_weekday",
            "weekend_energy": float(weekend),
            "weekday_energy": float(weekday),
            "description": "Weekday productivity comparison"
        })


    os.makedirs("site/data", exist_ok=True)

    with open(OUTPUT, "w") as f:
        json.dump(patterns, f, indent=2)

    print(f"[AETHER] Patterns written → {OUTPUT}")

if __name__ == "__main__":
    detect_patterns()