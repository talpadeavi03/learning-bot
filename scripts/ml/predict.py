import os
import pandas as pd
import joblib

MODEL_PATH = "models/productivity_model.pkl"
FEATURE_FILE = "data/features/behavior_features.parquet"


def load_data():

    if not os.path.exists(FEATURE_FILE):
        print("Feature dataset not found. Skipping prediction.")
        return None

    return pd.read_parquet(FEATURE_FILE)


def load_model():

    if not os.path.exists(MODEL_PATH):
        print("Model not found. Skipping prediction.")
        return None

    return joblib.load(MODEL_PATH)


def generate_predictions(df, model):

    X = df[["study_minutes", "exercise_minutes", "expense_amount"]]

    df["predicted_productivity"] = model.predict(X)

    return df


def main():

    df = load_data()
    model = load_model()

    if df is None or model is None:
        return

    df = generate_predictions(df, model)

    latest = df.tail(1)

    print("\nLatest Behavior Prediction\n")
    print(latest)


if __name__ == "__main__":
    main()