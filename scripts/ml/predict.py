"""
predict.py
Loads trained model, runs predictions, writes site/data/dashboard.json
Input:  models/saved_models/productivity_model.pkl
        data/raw/events.csv
Output: site/data/dashboard.json
"""
import os
import json
import pickle
from collections import Counter
from datetime import datetime, timedelta

import pandas as pd
import numpy as np

FLOW_LABELS = {
    2:  'FLOW',
    1:  'PRE_FLOW',
    0:  'NOMINAL',
    -1: 'ANXIETY',
    -2: 'RECOVERY',
}

FEATURES = [
    'energy_signal', 'stress_signal', 'focus_signal', 'motivation_signal',
    'hour_sin', 'hour_cos',
    'is_study_session', 'is_goal_mention', 'is_complaint',
]

def predict():
    model_path = 'models/saved_models/productivity_model.pkl'
    csv_path   = 'data/raw/events.csv'

    if not os.path.exists(model_path):
        print("[AETHER] No model found — run train_models.py first")
        return
    if not os.path.exists(csv_path):
        print("[AETHER] No events.csv — run pull_events.py first")
        return

    # Load model
    with open(model_path, 'rb') as f:
        m = pickle.load(f)
    clf, reg, scaler = m['clf'], m['reg'], m['scaler']

    # Load and prepare data
    df = pd.read_csv(csv_path)
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    df = df.dropna(subset=['timestamp'])
    df['hour']     = df['timestamp'].dt.hour
    df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
    df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)

    for col in ['energy_signal', 'stress_signal', 'focus_signal', 'motivation_signal']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.5)
    for col in ['is_study_session', 'is_goal_mention', 'is_complaint']:
        df[col] = df[col].fillna(False).astype(int)

    # Use today's events or last 20 if not enough
    today    = datetime.now().date()
    today_df = df[df['timestamp'].dt.date == today]
    src      = today_df if len(today_df) >= 3 else df.tail(20)

    Xs         = scaler.transform(src[FEATURES].fillna(0))
    flow_preds = clf.predict(Xs)
    prod_preds = reg.predict(Xs)

    # Dominant flow state
    dom_flow   = Counter(flow_preds).most_common(1)[0][0]
    flow_label = FLOW_LABELS.get(dom_flow, 'NOMINAL')
    flow_prob  = round(float(np.mean(flow_preds == dom_flow) * 100))

    avg_energy = round(float(src['energy_signal'].mean()) * 100)
    avg_stress = round(float(src['stress_signal'].mean()) * 100)
    avg_focus  = round(float(src['focus_signal'].mean()) * 100)
    avg_prod   = round(float(np.mean(prod_preds)) * 100)

    # Peak hour (IST)
    df['prod_pred'] = reg.predict(scaler.transform(df[FEATURES].fillna(0)))
    peak_utc        = int(df.groupby('hour')['prod_pred'].mean().idxmax())
    peak_ist        = (peak_utc + 5) % 24
    peak_str        = f"{peak_ist % 12 or 12}{'pm' if peak_ist >= 12 else 'am'} IST"

    # 7-day energy trend
    week_data = []
    for i in range(6, -1, -1):
        d     = (datetime.now() - timedelta(days=i)).date()
        day_e = df[df['timestamp'].dt.date == d]['energy_signal']
        week_data.append(round(float(day_e.mean()), 2) if len(day_e) > 0 else 0)

    # Streak
    all_days = set(df['timestamp'].dt.date.astype(str))
    streak   = 0
    for i in range(365):
        d = (datetime.now() - timedelta(days=i)).date().isoformat()
        if d in all_days:
            streak += 1
        elif i > 0:
            break

    # Topics today
    topic_counts = {}
    for _, row in today_df.iterrows():
        t = row.get('topic', '')
        if t and t not in ('general', 'nan', ''):
            topic_counts[t] = topic_counts.get(t, 0) + 1
    activity = [
        {'topic': t, 'minutes': c * 25, 'cat': 'LOGGED'}
        for t, c in sorted(topic_counts.items(), key=lambda x: -x[1])[:5]
    ]

    # Build dashboard
    dashboard = {
        'metrics': {
            'focus':        avg_focus,
            'learning':     avg_energy,
            'productivity': avg_prod,
            'mood':         100 - avg_stress,
            'flow_prob':    flow_prob,
            'flow_class':   flow_label,
            'peak_hour':    peak_str,
            'total_events': len(df),
            'streak':       streak,
            'last_updated': datetime.now().isoformat(),
            'model_events': int(m.get('n_events', len(df))),
        },
        'weekData': week_data,
        'activity': activity,
        'insights': [
            {
                'icon':     '🎯',
                'title':    f'Flow state: {flow_label}',
                'body':     f'ML model confidence {flow_prob}%. Based on {len(src)} recent events. '
                            + ('Protect this window — deep work only.' if flow_label == 'FLOW'
                               else 'Build momentum with a small focused task.' if flow_label == 'PRE_FLOW'
                               else 'Break tasks into smaller steps.' if flow_label == 'ANXIETY'
                               else 'Light tasks only — you need recovery.' if flow_label == 'RECOVERY'
                               else 'Keep logging to improve predictions.'),
                'tag':      'ML PREDICTION',
                'tagClass': 'tag-ok' if flow_label in ('FLOW', 'PRE_FLOW') else 'tag-med',
            },
            {
                'icon':     '⚡',
                'title':    f'Peak hour: {peak_str}',
                'body':     f'Your data shows highest productivity around {peak_str}. Schedule deep work then.',
                'tag':      'PATTERN',
                'tagClass': 'tag-ok',
            },
            {
                'icon':     '🔥',
                'title':    f'{streak}-day streak',
                'body':     f'You have logged data for {streak} consecutive days. Model trained on {len(df)} total events.',
                'tag':      'HIGH PRIORITY' if streak >= 7 else 'POSITIVE',
                'tagClass': 'tag-hi' if streak >= 7 else 'tag-ok',
            },
        ],
    }

    os.makedirs('site/data', exist_ok=True)
    with open('site/data/dashboard.json', 'w') as f:
        json.dump(dashboard, f, indent=2)

    print(f"[AETHER] dashboard.json written successfully")
    print(f"  Flow:    {flow_label} ({flow_prob}%)")
    print(f"  Energy:  {avg_energy}%  Stress: {avg_stress}%  Focus: {avg_focus}%")
    print(f"  Peak:    {peak_str}")
    print(f"  Streak:  {streak} days")

if __name__ == '__main__':
    predict()