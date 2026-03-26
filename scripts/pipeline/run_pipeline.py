import subprocess
import os

os.system("node scripts/analytics/build_code_graph.js")
os.system("python scripts/analytics/generate_architecture.py")

steps = [
    "python scripts/features/feature_extractor.py",
    "python scripts/features/state_vector_builder.py",
    "python scripts/ml/train_models.py",
    "python scripts/ml/predict.py",
    "python scripts/analytics/insight_generator.py",
    "python scripts/analytics/dashboard_data.py"
]

for step in steps:
    print("Running:", step)
    subprocess.run(step, shell=True, check=True)

print("Pipeline completed successfully")