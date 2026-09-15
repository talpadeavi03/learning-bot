"""
insight_generator.py — Behavioral Insight & Recommendation Engine
Generates human-readable actionable insights for both:
  - analytics/daily_insights.md (Report)
  - site/data/insights.json (PWA UI)
"""

import os
import sys
import json
import csv
from datetime import datetime, timezone, timedelta
from pathlib import Path

DATA_FILE = "data/processed/events_clean.csv"
OUTPUT_MD = "analytics/daily_insights.md"
OUTPUT_JSON = "site/data/insights.json"

def get_today_ist():
    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    return now_ist.strftime("%Y-%m-%d")

def generate():
    today = get_today_ist()
    target_csv = DATA_FILE if os.path.exists(DATA_FILE) else "data/raw/events.csv"

    if not os.path.exists(target_csv):
        print(f"[insight_generator] No {target_csv} found")
        return

    rows = []
    with open(target_csv, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    today_rows = [r for r in rows if r.get("timestamp", "").startswith(today)]
    recent_rows = today_rows if today_rows else rows[-15:]

    # Calculate metrics
    def avg_val(field, default=0.5):
        vals = []
        for r in recent_rows:
            try:
                vals.append(float(r.get(field, default) or default))
            except:
                vals.append(default)
        return sum(vals) / max(len(vals), 1)

    avg_e = avg_val("energy_signal", 0.6)
    avg_s = avg_val("stress_signal", 0.25)
    avg_f = avg_val("focus_signal", 0.65)

    topics = [r.get("topic") for r in recent_rows if r.get("topic")]
    top_topic = max(set(topics), key=topics.count) if topics else "MLOps"

    insights = []
    if avg_f > 0.7:
        insights.append(f"Strong focus signal ({int(avg_f*100)}%) detected. Excellent window for deep technical work in {top_topic}.")
    elif avg_f > 0.5:
        insights.append(f"Moderate focus maintained. Breaking {top_topic} tasks into 25-minute sprints will maximize output.")
    else:
        insights.append("Focus is diffuse. Eliminate distractions and pick one single task to build momentum.")

    if avg_e > 0.7:
        insights.append(f"High energy level ({int(avg_e*100)}%). Capitalize on this peak window.")
    elif avg_e < 0.4:
        insights.append("Energy is dipping below baseline. Take a 15-minute walk or hydrate to recover flow.")

    if avg_s > 0.6:
        insights.append("Elevated stress levels detected. Prioritize recovery and simplify today's goals.")
    else:
        insights.append("Stress levels are calm and well-regulated.")

    if len(today_rows) > 0:
        insights.append(f"Great active logging today: {len(today_rows)} events recorded across {top_topic}.")
    else:
        insights.append("Awaiting more check-ins today. Next logged session will refine real-time predictions.")

    # Save Markdown report
    Path(OUTPUT_MD).parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_MD, "w", encoding="utf-8") as f:
        f.write("# Daily Behavior & Productivity Insights\n\n")
        f.write(f"**Date (IST):** {today}\n")
        f.write(f"**Sampled Events:** {len(recent_rows)}\n\n")
        f.write("## Core Signals\n")
        f.write(f"- ⚡ **Energy:** {int(avg_e*100)}%\n")
        f.write(f"- 🎯 **Focus:** {int(avg_f*100)}%\n")
        f.write(f"- 😤 **Stress:** {int(avg_s*100)}%\n")
        f.write(f"- 🧠 **Primary Focus Area:** {top_topic}\n\n")
        f.write("## Actionable Insights\n")
        for ins in insights:
            f.write(f"- {ins}\n")

    # Save JSON for PWA Dashboard
    Path(OUTPUT_JSON).parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "date": today,
        "energy_pct": int(avg_e * 100),
        "focus_pct": int(avg_f * 100),
        "stress_pct": int(avg_s * 100),
        "top_topic": top_topic,
        "insights": insights,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"[insight_generator] Generated {len(insights)} insights -> {OUTPUT_MD} & {OUTPUT_JSON} ✅")

if __name__ == "__main__":
    generate()
