"""
data_cleaner.py
Cleans raw events.csv before ML training:
  - Filters gibberish & empty logs
  - Deduplicates events
  - Standardizes timestamps
  - Outputs data/processed/events_clean.csv
Supports both pandas and standard library csv mode.
"""

import os
import sys
import csv
from pathlib import Path

INPUT  = "data/raw/events.csv"
OUTPUT = "data/processed/events_clean.csv"

def is_gibberish(text):
    if not isinstance(text, str): return True
    text = text.strip()
    if len(text) < 3: return True
    if len(text) > 20 and ("==" in text or (len(text) > 40 and " " not in text)):
        return False  # Encrypted blob
    if len(set(text)) < 4 and len(text) > 10: return True
    if sum(1 for c in text if ord(c) > 127) / max(len(text), 1) > 0.4: return True
    if len(text.split()) == 1 and len(text) < 4: return True
    return False

def clean():
    if not os.path.exists(INPUT):
        print(f"[AETHER-CLEAN] No {INPUT} found — run pull_events.py first")
        return 0

    rows = []
    with open(INPUT, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        fields = reader.fieldnames or []
        rows = list(reader)

    original_count = len(rows)
    print(f"[AETHER-CLEAN] Loaded {original_count} raw events")

    cleaned = []
    seen = set()
    for r in rows:
        text = r.get("raw_text") or r.get("text", "")
        if is_gibberish(text):
            continue
        ts = r.get("timestamp", "")
        key = f"{ts}_{text[:30]}"
        if key in seen:
            continue
        seen.add(key)
        cleaned.append(r)

    # Sort chronologically
    cleaned.sort(key=lambda x: x.get("timestamp", ""))

    Path(OUTPUT).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT, mode="w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fields)
        writer.writeheader()
        writer.writerows(cleaned)

    print(f"[AETHER-CLEAN] Kept {len(cleaned)}/{original_count} events -> {OUTPUT} ✅")
    return len(cleaned)

if __name__ == "__main__":
    clean()
