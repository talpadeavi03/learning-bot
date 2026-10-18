"""
nlp_parser.py — Batch Event Ingestion & Heuristic NLP Parser
Used by .github/workflows/ingest.yml to ingest batches from Telegram dispatch (events.json)
into data/raw/events.csv with the full 24-feature schema.
"""

import os
import sys
import csv
import json
import math
from datetime import datetime, timezone
from pathlib import Path

INPUT_FILE = Path("events.json")
DATA_FILE = Path("data/raw/events.csv")
PROCESSED_FILE = Path("data/processed/events_clean.csv")

FIELDNAMES = [
    "timestamp", "input_type", "raw_text", "topic", "category",
    "sentiment", "energy_signal", "stress_signal", "focus_signal",
    "motivation_signal", "dominant_emotion", "is_study_session",
    "is_goal_mention", "is_complaint", "estimated_minutes", "summary",
    "word_count", "complexity", "question_ratio", "hour_sin", "hour_cos",
    "day_of_week", "is_weekend", "flow_class"
]

HIGH_ENERGY_WORDS = [
    "excited", "great", "amazing", "productive", "focused", "motivated",
    "energized", "pumped", "awesome", "fantastic", "built", "deployed",
    "shipped", "completed", "finished", "achieved", "nailed", "workout",
    "gym", "exercise", "run"
]

LOW_ENERGY_WORDS = [
    "tired", "exhausted", "drained", "sleepy", "lazy", "slow",
    "fatigue", "burnt", "burned out", "no energy", "can't focus",
    "resting", "nap", "crashed", "bored"
]

HIGH_STRESS_WORDS = [
    "stressed", "overwhelmed", "anxious", "worried", "deadline",
    "stuck", "confused", "panic", "frustrated", "angry", "annoyed",
    "too much", "failing", "error", "bug", "crash"
]

HIGH_FOCUS_WORDS = [
    "coding", "building", "studying", "learning", "deep work",
    "focused session", "reading", "writing", "debugging", "research",
    "terraform", "kubernetes", "docker", "pipeline"
]

STUDY_WORDS = [
    "learned", "studied", "reading", "course", "practice", "tutorial",
    "lesson", "notes", "cert", "exam", "coding", "building", "project"
]

TOPIC_KEYWORDS = {
    "kubernetes": ["k8s", "kubernetes", "pod", "cluster", "helm"],
    "docker": ["docker", "container", "image", "dockerfile"],
    "devops": ["devops", "ci/cd", "pipeline", "github actions", "deploy"],
    "mlops": ["mlops", "mlflow", "dagshub", "model", "inference"],
    "python": ["python", "pandas", "numpy", "fastapi", "scikit"],
    "cloud": ["cloudflare", "aws", "gcp", "azure", "worker"],
}

def parse_text_signals(text: str):
    lower = text.lower()
    words = [w.strip(".,!?:;\"'()[]{}") for w in lower.split() if w.strip()]
    word_count = len(words)

    high_e = sum(1 for w in HIGH_ENERGY_WORDS if w in lower)
    low_e = sum(1 for w in LOW_ENERGY_WORDS if w in lower)
    high_s = sum(1 for w in HIGH_STRESS_WORDS if w in lower)
    high_f = sum(1 for w in HIGH_FOCUS_WORDS if w in lower)
    is_study = any(w in lower for w in STUDY_WORDS)

    energy = 0.5
    if high_e > 0 or low_e > 0:
        energy = max(0.05, min(0.95, 0.5 + high_e * 0.15 - low_e * 0.2))

    stress = 0.2
    if high_s > 0:
        stress = max(0.05, min(0.95, 0.2 + high_s * 0.2))

    focus = 0.5
    if high_f > 0:
        focus = max(0.1, min(0.95, 0.5 + high_f * 0.15))
    elif is_study:
        focus = 0.75

    motivation = max(0.1, min(0.95, 0.5 + (energy - stress) * 0.4))
    sentiment = "positive" if energy > 0.6 and stress < 0.3 else ("negative" if stress > 0.5 or energy < 0.3 else "neutral")

    detected_topic = "general"
    for topic, kws in TOPIC_KEYWORDS.items():
        if any(kw in lower for kw in kws):
            detected_topic = topic
            break

    category = "learning" if is_study else ("health" if any(w in lower for w in ["gym", "run", "sleep", "water", "food"]) else "general")
    is_goal = any(w in lower for w in ["goal", "target", "plan", "finish", "complete", "milestone"])
    is_complaint = any(w in lower for w in ["hate", "annoying", "broken", "waste", "stuck"])

    # Complexity: avg word length / 10
    avg_len = sum(len(w) for w in words) / max(len(words), 1)
    complexity = min(1.0, round(avg_len / 10.0, 3))
    question_ratio = 1.0 if "?" in text else 0.0

    # Flow calculation
    if energy > 0.75 and stress < 0.25 and focus > 0.65:
        flow_class = 2
    elif energy > 0.60 and stress < 0.35:
        flow_class = 1
    elif stress > 0.65:
        flow_class = -1
    elif energy < 0.30:
        flow_class = -2
    else:
        flow_class = 0

    return {
        "topic": detected_topic,
        "category": category,
        "sentiment": sentiment,
        "energy_signal": round(energy, 2),
        "stress_signal": round(stress, 2),
        "focus_signal": round(focus, 2),
        "motivation_signal": round(motivation, 2),
        "dominant_emotion": "flow" if flow_class == 2 else ("stress" if stress > 0.5 else "neutral"),
        "is_study_session": 1.0 if is_study else 0.0,
        "is_goal_mention": 1.0 if is_goal else 0.0,
        "is_complaint": 1.0 if is_complaint else 0.0,
        "estimated_minutes": 25 if is_study else 5,
        "summary": text[:80],
        "word_count": word_count,
        "complexity": complexity,
        "question_ratio": question_ratio,
        "flow_class": flow_class
    }

def main():
    if not INPUT_FILE.exists():
        print(f"[nlp_parser] {INPUT_FILE} not found — nothing to parse.")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        try:
            content = f.read().strip()
            if not content:
                print(f"[nlp_parser] {INPUT_FILE} is empty.")
                return
            events = json.loads(content)
        except Exception as e:
            print(f"[nlp_parser] Failed to read {INPUT_FILE}: {e}")
            return

    if not isinstance(events, list):
        if isinstance(events, dict) and "events" in events:
            events = events["events"]
        else:
            events = [events]

    print(f"[nlp_parser] Parsing {len(events)} events from {INPUT_FILE}...")
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    PROCESSED_FILE.parent.mkdir(parents=True, exist_ok=True)

    rows = []
    for ev in events:
        text = ev.get("raw_text") or ev.get("text") or ev.get("message") or ""
        if not text:
            continue
        ts_str = ev.get("timestamp") or datetime.now(timezone.utc).isoformat()
        try:
            dt = datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
        except:
            dt = datetime.now(timezone.utc)

        h = dt.hour
        h_sin = round(math.sin(2 * math.pi * h / 24.0), 3)
        h_cos = round(math.cos(2 * math.pi * h / 24.0), 3)
        dow = dt.weekday()
        is_wknd = 1.0 if dow in (5, 6) else 0.0

        signals = parse_text_signals(text)
        row = {
            "timestamp": dt.isoformat(),
            "input_type": ev.get("input_type", "text"),
            "raw_text": text,
            "topic": ev.get("topic") or signals["topic"],
            "category": ev.get("category") or signals["category"],
            "sentiment": ev.get("sentiment") or signals["sentiment"],
            "energy_signal": ev.get("energy_signal") or signals["energy_signal"],
            "stress_signal": ev.get("stress_signal") or signals["stress_signal"],
            "focus_signal": ev.get("focus_signal") or signals["focus_signal"],
            "motivation_signal": ev.get("motivation_signal") or signals["motivation_signal"],
            "dominant_emotion": ev.get("dominant_emotion") or signals["dominant_emotion"],
            "is_study_session": float(ev.get("is_study_session", signals["is_study_session"])),
            "is_goal_mention": float(ev.get("is_goal_mention", signals["is_goal_mention"])),
            "is_complaint": float(ev.get("is_complaint", signals["is_complaint"])),
            "estimated_minutes": int(ev.get("estimated_minutes") or signals["estimated_minutes"]),
            "summary": ev.get("summary") or signals["summary"],
            "word_count": signals["word_count"],
            "complexity": signals["complexity"],
            "question_ratio": signals["question_ratio"],
            "hour_sin": h_sin,
            "hour_cos": h_cos,
            "day_of_week": dow,
            "is_weekend": is_wknd,
            "flow_class": signals["flow_class"]
        }
        rows.append(row)

    if not rows:
        print("[nlp_parser] No valid rows parsed.")
        return

    # Append to DATA_FILE
    write_header = not DATA_FILE.exists() or DATA_FILE.stat().st_size == 0
    with open(DATA_FILE, "a", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=FIELDNAMES)
        if write_header:
            writer.writeheader()
        writer.writerows(rows)

    print(f"[nlp_parser] Appended {len(rows)} events to {DATA_FILE} ✅")

if __name__ == "__main__":
    main()
