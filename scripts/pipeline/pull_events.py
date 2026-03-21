"""
pull_events.py
Pulls events from Cloudflare KV via the /events worker endpoint
Saves to data/raw/events.csv for the ML pipeline
"""
import os
import csv
import requests

WORKER_URL = os.environ.get('WORKER_URL', 'https://learning-bot.talpadeavi0303.workers.dev')

def pull():
    print(f"[AETHER] Pulling events from {WORKER_URL}/events ...")
    try:
        r = requests.get(f"{WORKER_URL}/events?limit=500", timeout=30)
        r.raise_for_status()
        events = r.json().get('events', [])
    except Exception as e:
        print(f"[AETHER] ERROR pulling events: {e}")
        return 0

    print(f"[AETHER] Received {len(events)} events")
    if not events:
        print("[AETHER] No events yet — keep logging via Telegram!")
        return 0

    os.makedirs('data/raw', exist_ok=True)

    fieldnames = [
        'timestamp', 'input_type', 'raw_text', 'topic', 'topics',
        'sentiment', 'energy_signal', 'stress_signal', 'focus_signal',
        'motivation_signal', 'dominant_emotion', 'is_study_session',
        'is_goal_mention', 'is_complaint', 'estimated_minutes', 'summary',
        'state_label', 'flow_class', 'energy', 'stress', 'mood', 'flow_prob',
    ]

    with open('data/raw/events.csv', 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames, extrasaction='ignore')
        writer.writeheader()
        writer.writerows(events)

    print(f"[AETHER] Saved {len(events)} events to data/raw/events.csv")
    return len(events)

if __name__ == '__main__':
    n = pull()
    if n < 10:
        print(f"[AETHER] Need at least 10 events to train ML. Have {n}. Keep logging!")
    else:
        print(f"[AETHER] Ready for ML pipeline with {n} events.")