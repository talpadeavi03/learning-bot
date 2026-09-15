"""
predict.py — AETHER ML Pipeline
Loads trained models, generates predictions, writes dashboard.json.
Robust — works with or without a trained model, handles IST timezone,
and guarantees rich daily activity is always reflected.
"""

import os
import sys
import json
import csv
import math
import pickle
import warnings
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import Counter

sys.path.insert(0, str(Path(__file__).resolve().parent))
try:
    from model_classes import StandaloneFlowClassifier, StandaloneEnergyRegressor
except ImportError:
    pass

warnings.filterwarnings("ignore")

FLOW_LABELS = {
    2: "FLOW",
    1: "PRE_FLOW",
    0: "NOMINAL",
    -1: "ANXIETY",
    -2: "RECOVERY",
}

FEATURES = [
    "energy_signal",
    "stress_signal",
    "focus_signal",
    "motivation_signal",
    "hour_sin",
    "hour_cos",
    "day_of_week",
    "is_weekend",
    "word_count",
    "complexity",
    "question_ratio",
    "is_study_session",
    "is_goal_mention",
    "is_complaint",
]

def load_model():
    for path in [
        "models/productivity_model.pkl",
        "models/saved_models/productivity_model.pkl",
    ]:
        if not Path(path).exists():
            continue
        try:
            import joblib
            model = joblib.load(path)
            print(f"[AETHER] Model loaded via joblib: {path}")
            return model
        except Exception:
            try:
                with open(path, "rb") as f:
                    model = pickle.load(f)
                print(f"[AETHER] Model loaded via pickle: {path}")
                return model
            except Exception as e:
                print(f"[AETHER] Model load failed: {e}")

    print("[AETHER] No model found — using rule system")
    return None

def rule_flow(row):
    try:
        e = float(row.get("energy_signal", 0.5) or 0.5)
        s = float(row.get("stress_signal", 0.3) or 0.3)
        f = float(row.get("focus_signal", 0.5) or 0.5)
    except:
        e, s, f = 0.5, 0.3, 0.5

    if e > 0.75 and s < 0.25 and f > 0.65:
        return 2
    if e > 0.60 and s < 0.35:
        return 1
    if s > 0.65:
        return -1
    if e < 0.30:
        return -2
    return 0

def predict():
    target_file = None
    for p in ["data/processed/events_clean.csv", "data/raw/events.csv"]:
        if Path(p).exists():
            target_file = Path(p)
            break

    if not target_file:
        print("[AETHER] No dataset found")
        return

    rows = []
    with open(target_file, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if not rows:
        print("[AETHER] Dataset empty")
        return

    print(f"[AETHER] Loaded {len(rows)} events from {target_file}")
    model = load_model()

    # Align with India Standard Time (IST, UTC+5:30)
    now_ist = datetime.now(timezone.utc) + timedelta(hours=5, minutes=30)
    today_str = now_ist.date().isoformat()

    today_rows = [r for r in rows if r.get("timestamp", "").startswith(today_str)]
    src = today_rows if len(today_rows) >= 3 else (rows[-30:] if len(rows) > 30 else rows)

    def get_avg(field, default=0.5):
        vals = []
        for r in src:
            try:
                v = float(r.get(field, default) or default)
                vals.append(v)
            except:
                vals.append(default)
        return float(sum(vals) / max(len(vals), 1))

    avg_e = get_avg("energy_signal", 0.65)
    avg_s = get_avg("stress_signal", 0.25)
    avg_f = get_avg("focus_signal", 0.70)

    flow_class = 0
    flow_prob = 0.5
    flow_label = "NOMINAL"

    if model is not None:
        try:
            X = []
            for r in src:
                vec = []
                for feat in FEATURES:
                    try:
                        vec.append(float(r.get(feat, 0.0) or 0.0))
                    except:
                        vec.append(0.0)
                X.append(vec)

            preds = model.predict(X)
            flow_class = int(Counter(preds).most_common(1)[0][0])
            flow_prob = float(sum(1 for p in preds if p == flow_class) / max(len(preds), 1))
            flow_label = FLOW_LABELS.get(flow_class, "NOMINAL")
            print(f"[AETHER] ML Flow: {flow_label} (confidence={flow_prob:.2f})")
        except Exception as e:
            print(f"[AETHER] ML predict failed: {e}")
            flow_class = rule_flow(src[-1])
            flow_label = FLOW_LABELS.get(flow_class, "NOMINAL")
    else:
        flow_class = rule_flow(src[-1])
        flow_label = FLOW_LABELS.get(flow_class, "NOMINAL")

    print(f"[AETHER] Selected Flow State: {flow_label}")

    # Peak Hour calculation
    hour_buckets = {}
    for r in rows:
        ts = r.get("timestamp", "")
        if "T" in ts:
            try:
                h_str = ts.split("T")[1][:2]
                hour = int(h_str)
                energy = float(r.get("energy_signal", 0.5) or 0.5)
                hour_buckets.setdefault(hour, []).append(energy)
            except:
                pass

    peak_hour = None
    peak_avg = -1.0
    for h, vals in hour_buckets.items():
        m = sum(vals) / len(vals)
        if m > peak_avg:
            peak_avg = m
            peak_hour = h

    peak_str = f"{(peak_hour+5)%24:02d}:00 IST" if peak_hour is not None else "11:00 IST"

    # Week Energy calculation (last 7 days in IST)
    week_data = []
    for i in range(6, -1, -1):
        target_d = (now_ist - timedelta(days=i)).date().isoformat()
        day_energies = []
        for r in rows:
            if r.get("timestamp", "").startswith(target_d):
                try:
                    day_energies.append(float(r.get("energy_signal", 0.5) or 0.5))
                except:
                    pass
        if day_energies:
            week_data.append(round(sum(day_energies) / len(day_energies), 2))
        else:
            week_data.append(round(avg_e, 2))

    dashboard = {
        "flow_state": flow_label,
        "flow_probability": round(flow_prob, 3),
        "avg_energy": round(avg_e, 3),
        "avg_stress": round(avg_s, 3),
        "avg_focus": round(avg_f, 3),
        "peak_hour": peak_str,
        "week_energy": week_data,
        "active_date_ist": today_str,
        "today_events_count": len(today_rows),
        "status_message": f"Active: {len(today_rows)} events logged today" if len(today_rows) > 0 else "Baseline flow active",
        "generated_at": now_ist.isoformat(),
    }

    # Load and preserve existing dashboard keys (like topics, etc.)
    out_path = Path("site/data/dashboard.json")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    if out_path.exists():
        try:
            with open(out_path, "r", encoding="utf-8") as f:
                old = json.load(f)
                for k in ["topics", "daily_activity"]:
                    if k in old:
                        dashboard[k] = old[k]
        except Exception:
            pass

    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(dashboard, f, indent=2)

    print(f"[AETHER] dashboard.json written successfully ({len(today_rows)} logs today) ✅")

if __name__ == "__main__":
    predict()
