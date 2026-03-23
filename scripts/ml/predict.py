"""
predict.py — AETHER ML Pipeline
Loads trained models, generates predictions, writes dashboard.json.
Robust — works with or without a trained model.
"""

import os
import json
import warnings
import numpy as np
import pandas as pd

from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import Counter

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


# -----------------------------------------------------
# LOAD MODEL
# -----------------------------------------------------

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

            print(f"[AETHER] Model loaded: {path}")
            return model

        except Exception as e:

            print(f"[AETHER] Model load failed: {e}")

    print("[AETHER] No model found — using rule system")

    return None


# -----------------------------------------------------
# LOAD DATA
# -----------------------------------------------------

def load_data():

    for path in [
        "data/processed/events_clean.csv",
        "data/raw/events.csv",
    ]:

        if Path(path).exists():

            df = pd.read_csv(path)

            print(f"[AETHER] {len(df)} events from {path}")

            return df

    print("[AETHER] No dataset found")

    return pd.DataFrame()


# -----------------------------------------------------
# DATA PREPARATION
# -----------------------------------------------------

def prepare(df):

    df = df.copy()

    df["timestamp"] = pd.to_datetime(df.get("timestamp"), errors="coerce")

    df = df.dropna(subset=["timestamp"])

    if df.empty:
        return df

    # ---- TIME FEATURES ----

    df["hour"] = df["timestamp"].dt.hour

    df["hour_sin"] = np.sin(2 * np.pi * df["hour"] / 24)

    df["hour_cos"] = np.cos(2 * np.pi * df["hour"] / 24)

    df["day_of_week"] = df["timestamp"].dt.dayofweek

    df["is_weekend"] = df["day_of_week"].isin([5, 6]).astype(float)

    # ---- SIGNAL FEATURES ----

    signal_cols = [
        "energy_signal",
        "stress_signal",
        "focus_signal",
        "motivation_signal",
    ]

    for c in signal_cols:

        if c not in df.columns:
            df[c] = 0.5

        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.5)

    # ---- TEXT FEATURES ----

    text_cols = [
        "word_count",
        "complexity",
        "question_ratio",
    ]

    for c in text_cols:

        if c not in df.columns:
            df[c] = 0

        df[c] = pd.to_numeric(df[c], errors="coerce").fillna(0.0)

    # ---- BOOLEAN FEATURES ----

    bool_cols = [
        "is_study_session",
        "is_goal_mention",
        "is_complaint",
    ]

    for c in bool_cols:

        if c not in df.columns:

            df[c] = 0.0

        else:

            df[c] = df[c].fillna(False).astype(float)

    return df


# -----------------------------------------------------
# RULE BASED FLOW
# -----------------------------------------------------

def rule_flow(row):

    e = row.get("energy_signal", 0.5)
    s = row.get("stress_signal", 0.3)
    f = row.get("focus_signal", 0.5)

    if e > 0.75 and s < 0.25 and f > 0.65:
        return 2

    if e > 0.60 and s < 0.35:
        return 1

    if s > 0.65:
        return -1

    if e < 0.30:
        return -2

    return 0


# -----------------------------------------------------
# MAIN PREDICTION
# -----------------------------------------------------

def predict():

    df = load_data()

    model = load_model()

    now = datetime.now(timezone.utc)

    today = now.date().isoformat()

    if df.empty:

        print("[AETHER] No data")

        return

    df = prepare(df)

    if df.empty:

        print("[AETHER] Dataset empty after preparation")

        return

    today_df = df[df["timestamp"].dt.date.astype(str) == today]

    src = today_df if not today_df.empty else df.tail(30)

    # ---- ENSURE MODEL FEATURES EXIST ----

    for f in FEATURES:

        if f not in src.columns:
            src[f] = 0

    avg_e = float(src["energy_signal"].mean())

    avg_s = float(src["stress_signal"].mean())

    avg_f = float(src["focus_signal"].mean())

    # ---- FLOW PREDICTION ----

    flow_class = 0
    flow_prob = 0.5
    flow_label = "NOMINAL"

    if model is not None:

        try:

            X = src[FEATURES].values

            preds = model.predict(X)

            flow_class = int(Counter(preds).most_common(1)[0][0])

            flow_prob = float(np.mean(preds == flow_class))

            flow_label = FLOW_LABELS.get(flow_class, "NOMINAL")

            print(f"[AETHER] ML Flow: {flow_label}")

        except Exception as e:

            print(f"[AETHER] ML predict failed: {e}")

            flow_class = rule_flow(src.iloc[-1])

            flow_label = FLOW_LABELS.get(flow_class, "NOMINAL")

    else:

        flow_class = rule_flow(src.iloc[-1])

        flow_label = FLOW_LABELS.get(flow_class, "NOMINAL")

    print(f"[AETHER] Flow: {flow_label}")

    # ---- PEAK HOUR ----

    he = df.groupby(df["timestamp"].dt.hour)["energy_signal"].mean()

    peak_hour = int(he.idxmax()) if not he.empty else None

    peak_str = f"{(peak_hour+5)%24:02d}:00 IST" if peak_hour is not None else "Unknown"

    # ---- WEEK DATA ----

    week_data = []

    for i in range(6, -1, -1):

        d = (now - timedelta(days=i)).date().isoformat()

        ev = df[df["timestamp"].dt.date.astype(str) == d]

        week_data.append(

            round(float(ev["energy_signal"].mean()), 2) if not ev.empty else 0.0
        )

    # ---- DASHBOARD OUTPUT ----

    dashboard = {

        "flow_state": flow_label,

        "flow_probability": round(flow_prob, 3),

        "avg_energy": round(avg_e, 3),

        "avg_stress": round(avg_s, 3),

        "avg_focus": round(avg_f, 3),

        "peak_hour": peak_str,

        "week_energy": week_data,

        "generated_at": now.isoformat(),
    }

    Path("site/data").mkdir(parents=True, exist_ok=True)

    with open("site/data/dashboard.json", "w") as f:

        json.dump(dashboard, f, indent=2)

    print("[AETHER] dashboard.json written")


# -----------------------------------------------------

if __name__ == "__main__":

    predict()