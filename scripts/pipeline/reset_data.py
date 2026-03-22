"""
reset_data.py
ONE-TIME SCRIPT — clears all KV events for a fresh start.
Run this ONCE via: python scripts/pipeline/reset_data.py
Then start logging clean data via Telegram.
"""
import os
import requests

WORKER_URL = os.environ.get(
    'WORKER_URL',
    'https://learning-bot.talpadeavi0303.workers.dev'
)

def reset():
    print("[AETHER] Resetting all event data for fresh start...")
    print(f"[AETHER] Worker: {WORKER_URL}")
    print()

    confirm = input("Type RESET to confirm clearing all events: ")
    if confirm.strip() != 'RESET':
        print("[AETHER] Cancelled.")
        return

    try:
        r = requests.post(
            f"{WORKER_URL}/reset-data",
            json={ 'confirm': 'RESET_ALL_EVENTS' },
            timeout=30
        )
        data = r.json()
        if data.get('ok'):
            print(f"[AETHER] ✅ {data.get('message')}")
            print("[AETHER] Fresh start ready. Start logging via Telegram!")
        else:
            print(f"[AETHER] ❌ {data.get('error')}")
    except Exception as e:
        print(f"[AETHER] Error: {e}")

if __name__ == '__main__':
    reset()
