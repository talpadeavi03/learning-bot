import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
import joblib

INPUT_FILE = "data/features/daily_state_vector.parquet"
MODEL_FILE = "models/saved_models/productivity_model.pkl"

df = pd.read_parquet(INPUT_FILE)

# create label
df["productive_day"] = (df["productivity_index"] > 2).astype(int)

features = [
    "learning_index",
    "health_index",
    "emotion_index",
    "finance_index"
]

X = df[features]
y = df["productive_day"]

if len(df) < 5:
    print("Not enough data to train model yet.")
    exit()

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42
)

model = RandomForestClassifier()

model.fit(X_train, y_train)

accuracy = model.score(X_test, y_test)

print("Model accuracy:", accuracy)

joblib.dump(model, MODEL_FILE)

print("Model saved to:", MODEL_FILE)