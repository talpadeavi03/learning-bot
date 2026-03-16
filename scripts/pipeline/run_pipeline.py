import subprocess

steps = [
    "python scripts/features/feature_extractor.py",
    "python scripts/features/state_vector_builder.py",
    "python scripts/ml/train_models.py",
    "python scripts/ml/predict.py"
    "python scripts/analytics/dashboard_data.py"
]

for step in steps:
    print(f"Running: {step}")
    subprocess.run(step, shell=True, check=True)

print("Pipeline completed successfully")