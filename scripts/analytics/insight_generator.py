import pandas as pd
import joblib
from pathlib import Path

DATA_FILE = "data/features/daily_behavior.parquet"
MODEL_FILE = "models/productivity_model.pkl"
OUTPUT_FILE = "analytics/daily_insights.md"

# Load data
df = pd.read_parquet(DATA_FILE)

latest = df.sort_values("date").iloc[-1]

study = latest["study_minutes"]
exercise = latest["exercise_minutes"]
expense = latest["expense_amount"]

# Load model
model = joblib.load(MODEL_FILE)

X = pd.DataFrame([{
    "study_minutes": study,
    "exercise_minutes": exercise,
    "expense_amount": expense
}])

prediction = model.predict(X)[0]

# Generate insights
insights = []

if study > 300:
    insights.append("High study time detected. Learning activity is strong today.")

if exercise > 30:
    insights.append("Exercise contributes positively to productivity.")

if expense > 1000:
    insights.append("Spending today is higher than usual.")

if study == 0:
    insights.append("No study activity detected today.")

# Write report
Path("analytics").mkdir(exist_ok=True)

with open(OUTPUT_FILE, "w") as f:

    f.write("# Daily Behavior Insights\n\n")

    f.write(f"Date: {latest['date']}\n\n")

    f.write("## Behavior Summary\n\n")

    f.write(f"- Study minutes: {study}\n")
    f.write(f"- Exercise minutes: {exercise}\n")
    f.write(f"- Expense amount: {expense}\n\n")

    f.write("## Predicted Productivity\n\n")

    f.write(f"{prediction:.2f}\n\n")

    f.write("## Insights\n\n")

    for i in insights:
        f.write(f"- {i}\n")

print("Insight report generated:", OUTPUT_FILE)