"""
train_models.py — AETHER ML Pipeline
Trains flow state classifier + energy regressor.
MLflow tracking → DagsHub (free, no credit card).

SETUP (one-time):
1. Sign up at dagshub.com with GitHub
2. Create repo mirror: dagshub.com/talpadeavi03/learning-bot
3. Add to GitHub Secrets:
   DAGSHUB_TOKEN = your DagsHub token (Settings → Tokens)
4. Pipeline auto-tracks all experiments
"""

import os
import json
import joblib
import warnings
import numpy as np
import pandas as pd
from pathlib import Path

warnings.filterwarnings('ignore')

# ── MLflow setup (DagsHub) ─────────────────────────────────────
DAGSHUB_TOKEN = os.environ.get('DAGSHUB_TOKEN', '')
DAGSHUB_USER  = os.environ.get('DAGSHUB_USER', 'talpadeavi03')
DAGSHUB_REPO  = os.environ.get('DAGSHUB_REPO', 'learning-bot')

mlflow_available = False
try:
    import mlflow
    import dagshub
    if DAGSHUB_TOKEN:
        os.environ['DAGSHUB_USER_TOKEN'] = DAGSHUB_TOKEN
        dagshub.init(
            repo_owner=DAGSHUB_USER,
            repo_name=DAGSHUB_REPO,
            mlflow=True
        )
        mlflow.set_experiment('aether-flow-classifier')
        mlflow_available = True
        print('[AETHER] MLflow → DagsHub connected ✅')
        print(f'[AETHER] Tracking URI: {mlflow.get_tracking_uri()}')
    else:
        print('[AETHER] DAGSHUB_TOKEN not set — skipping MLflow')
        print('[AETHER] Add DAGSHUB_TOKEN to GitHub Secrets to enable')
except ImportError as e:
    print(f'[AETHER] MLflow/DagsHub not installed: {e}')

# ── Load data ─────────────────────────────────────────────────
CLEAN_PATH = Path('data/processed/events_clean.csv')
RAW_PATH   = Path('data/raw/events.csv')

csv_path = CLEAN_PATH if CLEAN_PATH.exists() else RAW_PATH

if not csv_path.exists():
    print(f'[AETHER] No data file found. Run pull_events.py first.')
    raise SystemExit(1)

df = pd.read_csv(csv_path)
print(f'[AETHER] Loaded {len(df)} events from {csv_path}')

if len(df) < 5:
    print(f'[AETHER] Only {len(df)} events — need at least 5 to train. Keep logging!')
    raise SystemExit(0)

# ── Feature engineering ────────────────────────────────────────
FEATURES = [
    'energy_signal', 'stress_signal', 'focus_signal', 'motivation_signal',
    'hour_sin', 'hour_cos', 'day_of_week', 'is_weekend',
    'word_count', 'complexity', 'question_ratio',
    'is_study_session', 'is_goal_mention', 'is_complaint',
]

# Fill missing values
for col in FEATURES:
    if col not in df.columns:
        df[col] = 0.0
    df[col] = pd.to_numeric(df[col], errors='coerce').fillna(0.0)

# Convert booleans
for col in ['is_weekend', 'is_study_session', 'is_goal_mention', 'is_complaint']:
    df[col] = df[col].astype(float)

# ── Build flow labels ──────────────────────────────────────────
def compute_flow(row):
    e = row.get('energy_signal', 0.5)
    s = row.get('stress_signal', 0.3)
    f = row.get('focus_signal',  0.5)
    if   e > 0.75 and s < 0.25 and f > 0.65: return 2   # FLOW
    elif e > 0.60 and s < 0.35:               return 1   # PRE_FLOW
    elif s > 0.65:                             return -1  # ANXIETY
    elif e < 0.30:                             return -2  # RECOVERY
    else:                                      return 0   # NOMINAL

FLOW_LABELS = {2:'FLOW', 1:'PRE_FLOW', 0:'NOMINAL', -1:'ANXIETY', -2:'RECOVERY'}

df['flow_class'] = df.apply(compute_flow, axis=1)
X = df[FEATURES].values
y = df['flow_class'].values

print(f'[AETHER] Flow distribution: {dict(zip(*np.unique(y, return_counts=True)))}')
print(f'[AETHER] Features: {len(FEATURES)}')

# ── Train models ───────────────────────────────────────────────
from sklearn.ensemble import RandomForestClassifier, GradientBoostingRegressor
from sklearn.model_selection import cross_val_score
from sklearn.preprocessing import LabelEncoder

# Flow state classifier
rf = RandomForestClassifier(
    n_estimators=100, max_depth=8,
    min_samples_split=2, random_state=42, n_jobs=-1
)

# Energy regressor
energy_target = df['energy_signal'].values
gbm = GradientBoostingRegressor(
    n_estimators=100, max_depth=4,
    learning_rate=0.1, random_state=42
)

# Train
rf.fit(X, y)
gbm.fit(X, energy_target)
print('[AETHER] Models trained ✅')

# ── Evaluate ───────────────────────────────────────────────────
rf_acc   = float(np.mean(rf.predict(X) == y))
gbm_rmse = float(np.sqrt(np.mean((gbm.predict(X) - energy_target)**2)))

# Cross-validation if enough data
cv_score = 0.0
if len(df) >= 10:
    try:
        cv_scores = cross_val_score(rf, X, y, cv=min(3, len(df)//3))
        cv_score = float(np.mean(cv_scores))
    except:
        cv_score = rf_acc

print(f'[AETHER] RF train accuracy: {rf_acc:.3f}')
print(f'[AETHER] CV score: {cv_score:.3f}')
print(f'[AETHER] GBM energy RMSE: {gbm_rmse:.3f}')

# Feature importance
fi = dict(zip(FEATURES, rf.feature_importances_.tolist()))
top_features = sorted(fi.items(), key=lambda x: x[1], reverse=True)[:5]
print(f'[AETHER] Top features: {top_features}')

# ── MLflow logging ────────────────────────────────────────────
if mlflow_available:
    with mlflow.start_run(run_name=f'aether-{len(df)}events'):
        # Params
        mlflow.log_params({
            'n_events':      len(df),
            'n_features':    len(FEATURES),
            'rf_estimators': 100,
            'rf_max_depth':  8,
        })
        # Metrics
        mlflow.log_metrics({
            'rf_train_accuracy': rf_acc,
            'rf_cv_score':       cv_score,
            'gbm_energy_rmse':   gbm_rmse,
            'flow_2_count':      int(np.sum(y == 2)),
            'flow_1_count':      int(np.sum(y == 1)),
            'flow_0_count':      int(np.sum(y == 0)),
            'flow_neg1_count':   int(np.sum(y == -1)),
            'flow_neg2_count':   int(np.sum(y == -2)),
        })
        # Feature importance
        for feat, imp in fi.items():
            mlflow.log_metric(f'fi_{feat}', imp)
        # Save model as artifact
        mlflow.sklearn.log_model(rf, 'flow_classifier')
        mlflow.sklearn.log_model(gbm, 'energy_regressor')
        print('[AETHER] MLflow run logged to DagsHub ✅')

# ── Save models locally ────────────────────────────────────────
Path('models').mkdir(exist_ok=True)
Path('models/saved_models').mkdir(exist_ok=True)

joblib.dump(rf,  'models/productivity_model.pkl')
joblib.dump(gbm, 'models/energy_regressor.pkl')

# Save training stats
stats = {
    'n_events':        len(df),
    'n_features':      len(FEATURES),
    'rf_accuracy':     rf_acc,
    'cv_score':        cv_score,
    'gbm_rmse':        gbm_rmse,
    'flow_distribution': {FLOW_LABELS[k]: int(v) for k, v in zip(*np.unique(y, return_counts=True))},
    'top_features':    top_features,
    'trained_at':      pd.Timestamp.now().isoformat(),
    'features':        FEATURES,
}
with open('models/training_stats.json', 'w') as f:
    json.dump(stats, f, indent=2)

print(f'[AETHER] Models saved to models/')
print(f'[AETHER] Training stats saved to models/training_stats.json')
print(f'[AETHER] ✅ Training complete — {len(df)} events, {rf_acc:.1%} accuracy')