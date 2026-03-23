import json
import pandas as pd
from pathlib import Path

STATE_FILE = "state/current_state.json"
DATA_FILE = "data/processed/events_clean.csv"


def update_state():

    if not Path(DATA_FILE).exists():
        return

    df = pd.read_csv(DATA_FILE)

    if df.empty:
        return

    latest = df.iloc[-1]

    state = {}

    if Path(STATE_FILE).exists():
        with open(STATE_FILE) as f:
            state = json.load(f)

    state["last_activity"] = latest.get("topic", "unknown")
    state["last_event_time"] = latest.get("timestamp")

    state["energy"] = float(latest.get("energy_signal", 0.5))
    state["focus"] = float(latest.get("focus_signal", 0.5))

    with open(STATE_FILE, "w") as f:
        json.dump(state, f, indent=2)

    print("[AETHER] state updated")


if __name__ == "__main__":
    update_state()