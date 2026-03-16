import pandas as pd
from sklearn.ensemble import RandomForestRegressor
import joblib
from pathlib import Path

INPUT_FILE = "data/features/daily_behavior.parquet"
MODEL_PATH = "models/productivity_model.pkl"


def load_data():
    return pd.read_parquet(INPUT_FILE)


def train_model(df):

    df["productivity_score"] = (
        df["study_minutes"] * 0.6 +
        df["exercise_minutes"] * 0.3 -
        df["expense_amount"] * 0.01
    )

    X = df[["study_minutes", "exercise_minutes", "expense_amount"]]
    y = df["productivity_score"]

    model = RandomForestRegressor()

    model.fit(X, y)

    return model


def main():

    df = load_data()

    model = train_model(df)

    Path("models").mkdir(exist_ok=True)

    joblib.dump(model, MODEL_PATH)

    print("Model saved:", MODEL_PATH)


if __name__ == "__main__":
    main()