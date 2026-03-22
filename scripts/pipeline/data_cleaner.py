"""
data_cleaner.py
Cleans raw events.csv before ML training.
Removes: gibberish, duplicates, too-short messages, non-English noise.
Run after pull_events.py, before train_models.py.
"""
import os
import re
import pandas as pd

INPUT  = 'data/raw/events.csv'
OUTPUT = 'data/processed/events_clean.csv'

def is_gibberish(text):
    if not isinstance(text, str): return True
    text = text.strip()
    if len(text) < 3:   return True
    # Repeated characters (like صروم repeated 100x)
    if len(set(text)) < 4 and len(text) > 10: return True
    # More than 40% non-ASCII = likely foreign noise from bad Whisper
    non_ascii = sum(1 for c in text if ord(c) > 127)
    if non_ascii / max(len(text), 1) > 0.4: return True
    # Single word too short
    words = text.split()
    if len(words) == 1 and len(text) < 5: return True
    return False

def clean():
    if not os.path.exists(INPUT):
        print(f"[AETHER] No {INPUT} — run pull_events.py first")
        return 0

    df = pd.read_csv(INPUT)
    original_count = len(df)
    print(f"[AETHER] Loaded {original_count} raw events")

    # Remove gibberish raw_text
    df = df[~df['raw_text'].apply(is_gibberish)]
    print(f"[AETHER] After gibberish filter: {len(df)}")

    # Remove duplicates (same raw_text within 60 seconds)
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    df = df.sort_values('timestamp')
    df = df.drop_duplicates(subset=['raw_text'], keep='first')
    print(f"[AETHER] After dedup: {len(df)}")

    # Remove checkin/mood events with no energy signal
    bad_mask = (df['input_type'].isin(['checkin','mood'])) & (df['energy_signal'].isna())
    df = df[~bad_mask]
    print(f"[AETHER] After removing incomplete check-ins: {len(df)}")

    # Fill missing numeric signals with sensible defaults
    for col in ['energy_signal','stress_signal','focus_signal','motivation_signal']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.5)

    # Remove events where ALL signals are exactly 0.5 (likely failed NLP)
    all_default = (
        (df['energy_signal'] == 0.5) &
        (df['stress_signal'] == 0.5) &
        (df['focus_signal']  == 0.5)
    )
    # Only remove if input_type is text (voice/image might genuinely be neutral)
    text_mask = (df['input_type'] == 'text') & all_default
    df = df[~text_mask]
    print(f"[AETHER] After removing failed NLP text events: {len(df)}")

    os.makedirs('data/processed', exist_ok=True)
    df.to_csv(OUTPUT, index=False)

    removed = original_count - len(df)
    print(f"\n[AETHER] ✅ Cleaned dataset saved to {OUTPUT}")
    print(f"  Original: {original_count} events")
    print(f"  Removed:  {removed} bad events")
    print(f"  Clean:    {len(df)} events ready for ML")
    return len(df)

if __name__ == '__main__':
    n = clean()
    if n < 10:
        print(f"\n[AETHER] Only {n} clean events. Need 10+ to train. Keep logging!")
    else:
        print(f"\n[AETHER] Ready for ML training with {n} clean events.")
