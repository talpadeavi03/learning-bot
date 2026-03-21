"""
push_dashboard.py
Pushes the ML-generated site/data/dashboard.json to Cloudflare KV
via the worker /update-dashboard endpoint
"""
import os
import json
import requests

WORKER_URL = os.environ.get('WORKER_URL', 'https://learning-bot.talpadeavi0303.workers.dev')

def push():
    path = 'site/data/dashboard.json'
    if not os.path.exists(path):
        print(f"[AETHER] {path} not found — run predict.py first")
        return

    with open(path, 'r') as f:
        dashboard = json.load(f)

    print(f"[AETHER] Pushing dashboard to {WORKER_URL}/update-dashboard ...")
    try:
        r = requests.post(
            f"{WORKER_URL}/update-dashboard",
            json=dashboard,
            timeout=30
        )
        print(f"[AETHER] Response: {r.status_code} — {r.text[:100]}")
    except Exception as e:
        print(f"[AETHER] ERROR pushing dashboard: {e}")

if __name__ == '__main__':
    push()