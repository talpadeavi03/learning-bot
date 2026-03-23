"""
data_cleaner.py
Cleans raw events.csv before ML training.

Removes:
- gibberish
- duplicates
- too-short messages
- failed NLP events

Run after pull_events.py, before train_models.py.
"""

import os
import pandas as pd

INPUT  = "data/raw/events.csv"
OUTPUT = "data/processed/events_clean.csv"


# ------------------------------------------------
# GIBBERISH DETECTION
# ------------------------------------------------

def is_gibberish(text):

    if not isinstance(text, str):
        return True

    text = text.strip()

    if len(text) < 3:
        return True

    # repeated characters
    if len(set(text)) < 4 and len(text) > 10:
        return True

    # foreign noise
    non_ascii = sum(1 for c in text if ord(c) > 127)

    if non_ascii / max(len(text), 1) > 0.4:
        return True

    # single short word
    words = text.split()

    if len(words) == 1 and len(text) < 5:
        return True

    return False


# ------------------------------------------------
# MAIN CLEAN FUNCTION
# ------------------------------------------------

def clean():

    if not os.path.exists(INPUT):

        print(f"[AETHER] No {INPUT} — run pull_events.py first")

        return 0


    df = pd.read_csv(INPUT)

    original_count = len(df)

    print(f"[AETHER] Loaded {original_count} raw events")


    # ------------------------------------------------
    # DETECT TEXT COLUMN
    # ------------------------------------------------

    text_column = None

    if "raw_text" in df.columns:
        text_column = "raw_text"

    elif "text" in df.columns:
        text_column = "text"

    if text_column:
        df = df[~df[text_column].astype(str).apply(is_gibberish)]

    print(f"[AETHER] After gibberish filter: {len(df)}")


    # ------------------------------------------------
    # TIMESTAMP HANDLING
    # ------------------------------------------------

    if "timestamp" in df.columns:

        df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")

        df = df.sort_values("timestamp")


    # ------------------------------------------------
    # REMOVE DUPLICATES
    # ------------------------------------------------

    if text_column:

        df = df.drop_duplicates(subset=[text_column], keep="first")

    else:

        df = df.drop_duplicates()

    print(f"[AETHER] After dedup: {len(df)}")


    # ------------------------------------------------
    # REMOVE BAD CHECKINS
    # ------------------------------------------------

    if "input_type" in df.columns and "energy_signal" in df.columns:

        bad_mask = (
            df["input_type"].isin(["checkin", "mood"])
            & df["energy_signal"].isna()
        )

        df = df[~bad_mask]

    print(f"[AETHER] After removing incomplete check-ins: {len(df)}")


    # ------------------------------------------------
    # SIGNAL COLUMN SAFETY
    # ------------------------------------------------

    signal_cols = [
        "energy_signal",
        "stress_signal",
        "focus_signal",
        "motivation_signal",
    ]

    for col in signal_cols:

        if col not in df.columns:
            df[col] = 0.5

        df[col] = pd.to_numeric(df[col], errors="coerce").fillna(0.5)


    # ------------------------------------------------
    # REMOVE FAILED NLP EVENTS
    # ------------------------------------------------

    if "input_type" in df.columns:

        all_default = (
            (df["energy_signal"] == 0.5)
            & (df["stress_signal"] == 0.5)
            & (df["focus_signal"] == 0.5)
        )

        text_mask = (df["input_type"] == "text") & all_default

        df = df[~text_mask]

    print(f"[AETHER] After removing failed NLP text events: {len(df)}")


    # ------------------------------------------------
    # SAVE DATASET
    # ------------------------------------------------

    os.makedirs("data/processed", exist_ok=True)

    df.to_csv(OUTPUT, index=False)

    removed = original_count - len(df)


    print(f"\n[AETHER] ✅ Cleaned dataset saved to {OUTPUT}")

    print(f"  Original: {original_count} events")

    print(f"  Removed:  {removed} bad events")

    print(f"  Clean:    {len(df)} events ready for ML")


    return len(df)


# ------------------------------------------------
# ENTRY POINT
# ------------------------------------------------

if __name__ == "__main__":

    n = clean()

    if n < 10:

        print(f"\n[AETHER] Only {n} clean events. Need 10+ to train. Keep logging!")

    else:

        print(f"\n[AETHER] Ready for ML training with {n} clean events.")