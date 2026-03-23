"""
predict.py — AETHER ML Pipeline
Loads trained models, generates predictions, writes dashboard.json.
Robust — works with or without a trained model.
"""
import os, json, warnings
import numpy as np
import pandas as pd
from pathlib import Path
from datetime import datetime, timedelta, timezone
from collections import Counter

warnings.filterwarnings('ignore')

FLOW_LABELS = {2:'FLOW', 1:'PRE_FLOW', 0:'NOMINAL', -1:'ANXIETY', -2:'RECOVERY'}

FEATURES = [
    'energy_signal','stress_signal','focus_signal','motivation_signal',
    'hour_sin','hour_cos','day_of_week','is_weekend',
    'word_count','complexity','question_ratio',
    'is_study_session','is_goal_mention','is_complaint',
]

def load_model():
    for path in ['models/productivity_model.pkl','models/saved_models/productivity_model.pkl']:
        if not Path(path).exists(): continue
        try:
            import joblib
            m = joblib.load(path)
            print(f'[AETHER] Model loaded: {path}')
            return m
        except Exception as e:
            print(f'[AETHER] joblib failed for {path}: {e}')
    print('[AETHER] No model found — using rule-based predictions')
    return None

def load_data():
    for path in ['data/processed/events_clean.csv','data/raw/events.csv']:
        if Path(path).exists():
            df = pd.read_csv(path)
            print(f'[AETHER] {len(df)} events from {path}')
            return df
    return pd.DataFrame()

def prepare(df):
    df = df.copy()

    # timestamp parsing
    df['timestamp'] = pd.to_datetime(df.get('timestamp'), errors='coerce')
    df = df.dropna(subset=['timestamp'])
    if df.empty:
        return df

    # time features
    df['hour'] = df['timestamp'].dt.hour
    df['hour_sin'] = np.sin(2*np.pi*df['hour']/24)
    df['hour_cos'] = np.cos(2*np.pi*df['hour']/24)
    df['day_of_week'] = df['timestamp'].dt.dayofweek
    df['is_weekend'] = df['day_of_week'].isin([5,6]).astype(float)

    # numeric signals
    signal_cols = [
        'energy_signal',
        'stress_signal',
        'focus_signal',
        'motivation_signal'
    ]

    for c in signal_cols:
        if c not in df.columns:
            df[c] = 0.5
        df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0.5)

    # text features
    text_cols = [
        'word_count',
        'complexity',
        'question_ratio'
    ]

    for c in text_cols:
        if c not in df.columns:
            df[c] = 0
        df[c] = pd.to_numeric(df[c], errors='coerce').fillna(0.0)

    # boolean flags
    bool_cols = [
        'is_study_session',
        'is_goal_mention',
        'is_complaint'
    ]

    for c in bool_cols:
        if c not in df.columns:
            df[c] = 0.0
        else:
            df[c] = df[c].fillna(False).astype(float)

    return df

def rule_flow(row):
    e,s,f = row.get('energy_signal',0.5), row.get('stress_signal',0.3), row.get('focus_signal',0.5)
    if e>0.75 and s<0.25 and f>0.65: return 2
    if e>0.60 and s<0.35:            return 1
    if s>0.65:                       return -1
    if e<0.30:                       return -2
    return 0

def predict():
    df    = load_data()
    model = load_model()
    now   = datetime.now(timezone.utc)
    today = now.date().isoformat()

    if df.empty:
        print('[AETHER] No data — writing default dashboard')
        write_default(); return

    df     = prepare(df)
    if df.empty:
        write_default(); return

    today_df = df[df['timestamp'].dt.date.astype(str) == today]
    src      = today_df if not today_df.empty else df.head(30)

    avg_e = float(src['energy_signal'].mean())
    avg_s = float(src['stress_signal'].mean())
    avg_f = float(src['focus_signal'].mean())

    # Flow prediction
    flow_class, flow_prob, flow_label = 0, 0.5, 'NOMINAL'
    if model is not None:
        try:
            X = src[FEATURES].values
            preds = model.predict(X)
            flow_class = int(Counter(preds).most_common(1)[0][0])
            flow_prob  = float(np.mean(preds == flow_class))
            flow_label = FLOW_LABELS.get(flow_class, 'NOMINAL')
            print(f'[AETHER] ML Flow: {flow_label} ({flow_prob:.0%})')
        except Exception as e:
            print(f'[AETHER] ML predict failed: {e} — using rules')
            flow_class = rule_flow(src.iloc[-1])
            flow_label = FLOW_LABELS.get(flow_class, 'NOMINAL')
    else:
        flow_class = rule_flow(src.iloc[-1]) if not src.empty else 0
        flow_label = FLOW_LABELS.get(flow_class, 'NOMINAL')
    print(f'[AETHER] Flow: {flow_label}')

    # Peak hour IST
    he = df.groupby(df['timestamp'].dt.hour)['energy_signal'].mean()
    peak_str = f"{(int(he.idxmax())+5)%24:02d}:00 IST" if not he.empty else 'Unknown'

    # 7-day weekData
    week_data = []
    for i in range(6,-1,-1):
        d = (now-timedelta(days=i)).date().isoformat()
        ev = df[df['timestamp'].dt.date.astype(str)==d]
        week_data.append(round(float(ev['energy_signal'].mean()),2) if not ev.empty else 0.0)

    # Streak
    streak, check = 0, now.date()
    for _ in range(365):
        if not df[df['timestamp'].dt.date.astype(str)==check.isoformat()].empty:
            streak += 1; check -= timedelta(days=1)
        else: break

    # Topics
    tc = Counter(src['topic'].dropna())
    activity = [{'topic':t,'minutes':c*20,'cat':'LOGGED'}
                for t,c in tc.most_common(6)
                if t and str(t).lower() not in ('none','null','general','')]

    # Timeline
    timeline = []
    for _,row in today_df.head(8).iterrows():
        ist = row['timestamp'] + timedelta(hours=5,minutes=30)
        timeline.append({'time':ist.strftime('%H:%M'),
            'event':f"{row.get('input_type','log')}: {str(row.get('summary',row.get('topic','logged')))[:60]}"})

    # Hourly heatmap + input counts
    hourly = [0]*24
    for h,cnt in df.groupby(df['timestamp'].dt.hour).size().items():
        hourly[int(h)] = int(cnt)
    input_counts = dict(Counter(df['input_type'].dropna()))

    # Insights
    insights = []
    if peak_str != 'Unknown':
        insights.append({'icon':'⚡','title':f'Peak hour: {peak_str}',
            'body':f'Your energy peaks around {peak_str}. Schedule deep work then.',
            'tag':'PATTERN','tagClass':'tag-ok'})
    if avg_e > 0.7:
        insights.append({'icon':'🔥','title':'High energy today',
            'body':f'Energy at {avg_e:.0%}. Good time for hard problems.',
            'tag':'ENERGY','tagClass':'tag-ok'})
    elif avg_e < 0.4:
        insights.append({'icon':'💤','title':'Low energy detected',
            'body':'Rest or lighter tasks today. Recovery is performance.',
            'tag':'RECOVERY','tagClass':'tag-med'})
    if avg_s > 0.6:
        insights.append({'icon':'🧘','title':'Stress elevated',
            'body':f'Stress at {avg_s:.0%}. Take breaks and breathe.',
            'tag':'STRESS','tagClass':'tag-hi'})
    if streak >= 3:
        insights.append({'icon':'🏆','title':f'{streak}-day streak!',
            'body':'Consistency builds the model that knows you.',
            'tag':'STREAK','tagClass':'tag-ok'})
    if not insights:
        insights.append({'icon':'📊','title':'Keep logging',
            'body':f'{len(df)} events. More data = smarter AETHER.',
            'tag':'INFO','tagClass':'tag-ok'})

    dashboard = {
        'generated_at': now.isoformat(),
        'n_events':     len(df),
        'flow_label':   flow_label,
        'flow_class':   flow_class,
        'flow_prob':    round(flow_prob,3),
        'peak_hour':    peak_str,
        'streak':       streak,
        'todayCount':   len(today_df),
        'metrics': {
            'focus':        round(avg_f*100),
            'learning':     round(avg_e*90),
            'productivity': round(flow_prob*100),
            'mood':         round((1-avg_s)*100),
            'last_updated': now.isoformat(),
        },
        'weekData':    week_data,
        'activity':    activity,
        'timeline':    timeline,
        'insights':    insights,
        'inputCounts': input_counts,
        'hourlyData':  hourly,
        'goals':       {'today':[],'week':[]},
    }

    Path('site/data').mkdir(parents=True, exist_ok=True)
    with open('site/data/dashboard.json','w') as f:
        json.dump(dashboard, f, indent=2)
    print(f'[AETHER] ✅ dashboard.json → Flow:{flow_label} Energy:{avg_e:.0%} Streak:{streak}d Events:{len(df)}')

def write_default():
    Path('site/data').mkdir(parents=True, exist_ok=True)
    d = {'generated_at':datetime.now(timezone.utc).isoformat(),
         'n_events':0,'flow_label':'NOMINAL','flow_class':0,'flow_prob':0.5,
         'peak_hour':'Unknown','streak':0,'todayCount':0,
         'metrics':{'focus':0,'learning':0,'productivity':0,'mood':0,'last_updated':datetime.now(timezone.utc).isoformat()},
         'weekData':[0]*7,'activity':[],'timeline':[],
         'insights':[{'icon':'🌱','title':'Start logging',
             'body':'Send messages to your Telegram bot to start.','tag':'START','tagClass':'tag-ok'}],
         'inputCounts':{},'hourlyData':[0]*24,'goals':{'today':[],'week':[]}}
    with open('site/data/dashboard.json','w') as f:
        json.dump(d,f,indent=2)
    print('[AETHER] Default dashboard.json written')

if __name__ == '__main__':
    predict()