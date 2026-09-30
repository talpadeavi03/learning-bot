import pandas as pd
import numpy as np
from datetime import datetime, timedelta

OUTPUT_FILE = "data/features/daily_state_vector.parquet"

days = 180
start_date = datetime(2026, 1, 1)

rows = []

for i in range(days):

    date = start_date + timedelta(days=i)

    study_hours = np.random.randint(0, 5)
    coding_hours = np.random.randint(0, 4)

    learning_index = study_hours + np.random.randint(0, 2)

    productivity_index = np.random.randint(0, 6)

    health_index = np.random.randint(0, 4)

    emotion_index = np.random.randint(4, 9)

    finance_index = np.random.randint(0, 800)

    rows.append({
        "date": date,
        "study_hours": study_hours,
        "coding_hours": coding_hours,
        "learning_index": learning_index,
        "productivity_index": productivity_index,
        "health_index": health_index,
        "emotion_index": emotion_index,
        "finance_index": finance_index
    })

df = pd.DataFrame(rows)

import os
os.makedirs(os.path.dirname(OUTPUT_FILE), exist_ok=True)
df.to_parquet(OUTPUT_FILE, index=False)

print("Synthetic dataset generated:", len(df), "days")