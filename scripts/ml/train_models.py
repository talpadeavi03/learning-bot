"""
train_models.py
Trains AETHER flow state classifier + productivity regressor
Input:  data/raw/events.csv
Output: models/saved_models/productivity_model.pkl
        models/training_stats.json
"""
import os
import json
import pickle
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.preprocessing import StandardScaler

FEATURES = [
    'energy_signal', 'stress_signal', 'focus_signal', 'motivation_signal',
    'hour_sin', 'hour_cos',
    'is_study_session', 'is_goal_mention', 'is_complaint',
]

FLOW_MAP = {
    'FLOW':     2,
    'PRE_FLOW': 1,
    'NOMINAL':  0,
    'ANXIETY':  -1,
    'RECOVERY': -2,
}

def auto_label(row):
    e = float(row.get('energy_signal', 0.5))
    s = float(row.get('stress_signal', 0.2))
    if e > 0.75 and s < 0.25: return 'FLOW'
    if e > 0.55 and s < 0.45: return 'PRE_FLOW'
    if s > 0.65:               return 'ANXIETY'
    if e < 0.25:               return 'RECOVERY'
    return 'NOMINAL'

def train():
    csv_path = 'data/processed/events_clean.csv' if os.path.exists('data/processed/events_clean.csv') else 'data/raw/events.csv'
    if not os.path.exists(csv_path):
        print("[AETHER] No events.csv — run pull_events.py first")
        return False

    df = pd.read_csv(csv_path)
    print(f"[AETHER] Loaded {len(df)} events")

    if len(df) < 10:
        print(f"[AETHER] Need 10+ events to train. Have {len(df)}. Keep logging!")
        return False

    # Time features
    df['timestamp'] = pd.to_datetime(df['timestamp'], errors='coerce')
    df = df.dropna(subset=['timestamp'])
    df['hour']     = df['timestamp'].dt.hour
    df['hour_sin'] = np.sin(2 * np.pi * df['hour'] / 24)
    df['hour_cos'] = np.cos(2 * np.pi * df['hour'] / 24)

    # Numeric features
    for col in ['energy_signal', 'stress_signal', 'focus_signal', 'motivation_signal']:
        df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.5)

    # Boolean features
    for col in ['is_study_session', 'is_goal_mention', 'is_complaint']:
        df[col] = df[col].fillna(False).astype(int)

    # Labels
    df['flow_label'] = df.apply(auto_label, axis=1)
    df['flow_num']   = df['flow_label'].map(FLOW_MAP)

    X      = df[FEATURES].fillna(0)
    scaler = StandardScaler()
    Xs     = scaler.fit_transform(X)

    # Flow classifier
    clf = RandomForestClassifier(
        n_estimators=100, max_depth=5,
        random_state=42, class_weight='balanced'
    )
    clf.fit(Xs, df['flow_num'])

    # Productivity regressor (predicts energy level)
    reg = GradientBoostingRegressor(
        n_estimators=100, max_depth=3,
        learning_rate=0.1, random_state=42
    )
    reg.fit(Xs, df['energy_signal'])

    # Save
    os.makedirs('models/saved_models', exist_ok=True)
    bundle = {
        'clf':      clf,
        'reg':      reg,
        'scaler':   scaler,
        'features': FEATURES,
        'n_events': len(df),
    }
    with open('models/saved_models/productivity_model.pkl', 'wb') as f:
        pickle.dump(bundle, f)

    # Stats
    stats = {
        'trained_at':  pd.Timestamp.now().isoformat(),
        'n_events':    len(df),
        'flow_dist':   df['flow_label'].value_counts().to_dict(),
        'avg_energy':  round(float(df['energy_signal'].mean()), 3),
        'avg_stress':  round(float(df['stress_signal'].mean()), 3),
        'date_range':  {
            'from': str(df['timestamp'].min().date()),
            'to':   str(df['timestamp'].max().date()),
        },
    }
    os.makedirs('models', exist_ok=True)
    with open('models/training_stats.json', 'w') as f:
        json.dump(stats, f, indent=2)

    print(f"[AETHER] Model trained successfully!")
    print(f"  Events:     {len(df)}")
    print(f"  Flow dist:  {stats['flow_dist']}")
    print(f"  Avg energy: {stats['avg_energy']}")
    return True

if __name__ == '__main__':
    train()
