"""
run_parallel_pipeline.py — Master Zero-Cost Parallel MLOps Orchestrator
Coordinates all parallel pipelines in an automated sequence:
  Stage 1: Architecture & Code Graphs
  Stage 2: Feature Extraction & State Vectors
  Stage 3: Parallel Data Quality Validation (Pandera + Great Expectations)
  Stage 4: Parallel Model Tournament (Scikit-Learn vs XGBoost + Optuna/Hyperopt + MLflow/W&B)
  Stage 5: Parallel Explainability (SHAP + LIME)
  Stage 6: Parallel Drift & Data Monitoring (Evidently AI + Whylogs)
  Stage 7: Offline Inference & Dashboard Aggregation
  Stage 8: Edge Synchronization (Worker KV Sync)
"""

import os
import sys
import time
import subprocess
from pathlib import Path

def run_step(description: str, cmd: str, ignore_error: bool = False):
    print(f"\n{'='*60}")
    print(f"🚀 [AETHER-ORCHESTRATOR] {description}")
    print(f"   Command: {cmd}")
    print(f"{'='*60}")
    start = time.time()
    try:
        subprocess.run(cmd, shell=True, check=True)
        elapsed = round(time.time() - start, 2)
        print(f"✅ Completed: {description} ({elapsed}s)")
    except subprocess.CalledProcessError as e:
        elapsed = round(time.time() - start, 2)
        if ignore_error:
            print(f"⚠️ Warning (non-fatal, proceeding): {description} failed ({elapsed}s) -> {e}")
        else:
            print(f"❌ Failed: {description} after {elapsed}s")
            raise

def main():
    total_start = time.time()
    py = sys.executable
    print("\n" + "#"*65)
    print("🌟 AETHER OS — ZERO-COST PARALLEL MLOPS PIPELINE")
    print("#"*65)

    # Stage 1: Graphs & System Brain
    run_step("Build Code Graph", f'"{py}" scripts/analytics/build_code_graph.py 2>/dev/null || node scripts/analytics/build_code_graph.js 2>/dev/null || true', ignore_error=True)
    run_step("Generate Architecture Specs", f'"{py}" scripts/analytics/generate_architecture.py', ignore_error=True)

    # Stage 2: Feature Extraction & Cleaning
    if Path("scripts/pipeline/data_cleaner.py").exists():
        run_step("Clean Dataset", f'"{py}" scripts/pipeline/data_cleaner.py', ignore_error=True)

    # Stage 3: Parallel Data Validation (Pandera + Great Expectations)
    run_step("Parallel Data Quality & Schema Validation", f'"{py}" scripts/pipeline/validate_data.py')

    # Stage 4: Parallel Model Tournament & Experiment Tracking
    run_step("Parallel Model Tournament (Scikit-Learn vs XGBoost, Optuna, MLflow)", f'"{py}" scripts/ml/train_parallel.py')

    # Stage 5: Parallel Explainability (SHAP + LIME)
    run_step("Parallel Explainability Engine (SHAP Global + LIME Local)", f'"{py}" scripts/ai/explain_models.py')

    # Stage 6: Drift & Governance Monitoring (Evidently AI + Whylogs)
    run_step("Drift Detection & Data Profiling (Evidently AI + Whylogs)", f'"{py}" scripts/analytics/drift_monitor.py', ignore_error=True)

    # Stage 7: Analytics & Prediction Outputs
    run_step("Run Inference & Predictions", f'"{py}" scripts/ml/predict.py')
    if Path("scripts/analytics/insight_generator.py").exists():
        run_step("Generate Insights", f'"{py}" scripts/analytics/insight_generator.py', ignore_error=True)
    if Path("scripts/analytics/dashboard_data.py").exists():
        run_step("Format Dashboard State", f'"{py}" scripts/analytics/dashboard_data.py', ignore_error=True)

    # Stage 8: Edge Sync (Push to Worker KV if configured)
    if os.environ.get("WORKER_URL") or os.environ.get("CLOUDFLARE_API_TOKEN"):
        run_step("Push Results to Cloudflare Edge KV", f'"{py}" scripts/pipeline/push_dashboard.py', ignore_error=True)
    else:
        print("\nℹ️ WORKER_URL / CLOUDFLARE_API_TOKEN not set — skipping edge sync (offline mode)")

    total_time = round(time.time() - total_start, 2)
    print("\n" + "#"*65)
    print(f"🎉 PARALLEL MLOPS PIPELINE COMPLETED SUCCESSFULLY in {total_time}s")
    print("#"*65 + "\n")

if __name__ == "__main__":
    main()
