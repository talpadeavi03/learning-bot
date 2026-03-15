import pandas as pd
import joblib

MODEL_FILE = "models/saved_models/productivity_model.pkl"
DATA_FILE = "data/features/daily_state_vector.parquet"

model = joblib.load(MODEL_FILE)

df = pd.read_parquet(DATA_FILE)

latest = df.iloc[-1]

features = [
    "learning_index",
    "health_index",
    "emotion_index",
    "finance_index"
]

X = pd.DataFrame([latest[features]])

prediction = model.predict(X)[0]
probability = model.predict_proba(X)[0][1]

print("\nAI Prediction Report")
print("-------------------")

print("Learning index:", latest["learning_index"])
print("Health index:", latest["health_index"])
print("Emotion index:", latest["emotion_index"])
print("Finance index:", latest["finance_index"])

print("\nPrediction:")

if prediction == 1:
    print("Tomorrow likely PRODUCTIVE")
else:
    print("Tomorrow may be LOW productivity")

print("Confidence:", round(probability * 100, 2), "%")