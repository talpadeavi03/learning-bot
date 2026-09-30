import subprocess
import os
import sys

py = sys.executable

os.system(f'"{py}" scripts/analytics/build_code_graph.py 2>/dev/null || node scripts/analytics/build_code_graph.js 2>/dev/null || true')
os.system(f'"{py}" scripts/analytics/generate_architecture.py')

steps = [
    f'"{py}" scripts/features/feature_extractor.py',
    f'"{py}" scripts/features/state_vector_builder.py',
    f'"{py}" scripts/ml/train_models.py',
    f'"{py}" scripts/ml/predict.py',
    f'"{py}" scripts/analytics/insight_generator.py',
    f'"{py}" scripts/analytics/dashboard_data.py'
]

for step in steps:
    print("Running:", step)
    subprocess.run(step, shell=True, check=True)

print("Pipeline completed successfully")