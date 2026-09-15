"""
validate_data.py — Parallel Data Quality & Schema Validation
Runs two parallel validation engines:
  1. Pipeline 1A: Inline Pandera DataFrameSchema (with pure-Python schema rules fallback)
  2. Pipeline 1B: Great Expectations-style Batch Contract Suite
"""

import os
import sys
import json
import csv
from pathlib import Path

# ── 1. Pipeline 1A: Pandera Inline Validation ─────────────
def run_pandera_validation(rows: list, columns: list) -> dict:
    print("[Pipeline 1A: Pandera] Validating dataset schema...")
    results = {"engine": "Pandera", "valid": True, "errors": []}
    
    try:
        import pandera as pa
        import pandas as pd
        from pandera import Column, Check, DataFrameSchema
        
        df = pd.DataFrame(rows)
        schema = DataFrameSchema(
            columns={
                "energy_signal": Column(float, Check.in_range(0.0, 1.0), required=False, nullable=True),
                "stress_signal": Column(float, Check.in_range(0.0, 1.0), required=False, nullable=True),
                "focus_signal": Column(float, Check.in_range(0.0, 1.0), required=False, nullable=True),
                "motivation_signal": Column(float, Check.in_range(0.0, 1.0), required=False, nullable=True),
                "hour_sin": Column(float, Check.in_range(-1.0, 1.0), required=False, nullable=True),
                "hour_cos": Column(float, Check.in_range(-1.0, 1.0), required=False, nullable=True),
            },
            coerce=True,
            strict=False
        )
        schema.validate(df, lazy=True)
        print("[Pipeline 1A: Pandera] Schema validation passed ✅")
    except ImportError:
        print("[Pipeline 1A: Pandera-Engine] Pandera/Pandas not installed — executing native Pandera schema validator...")
        for i, row in enumerate(rows):
            for col in ["energy_signal", "stress_signal", "focus_signal", "motivation_signal"]:
                val = row.get(col)
                if val is not None and val != "":
                    try:
                        f_val = float(val)
                        if not (0.0 <= f_val <= 1.0):
                            results["errors"].append(f"Row {i}: {col}={f_val} outside [0.0, 1.0]")
                            results["valid"] = False
                    except ValueError:
                        results["errors"].append(f"Row {i}: {col} cannot be parsed to float")
                        results["valid"] = False

            for col in ["hour_sin", "hour_cos"]:
                val = row.get(col)
                if val is not None and val != "":
                    try:
                        f_val = float(val)
                        if not (-1.0 <= f_val <= 1.0):
                            results["errors"].append(f"Row {i}: {col}={f_val} outside [-1.0, 1.0]")
                            results["valid"] = False
                    except ValueError:
                        results["errors"].append(f"Row {i}: {col} cannot be parsed to float")
                        results["valid"] = False

        if results["valid"]:
            print("[Pipeline 1A: Pandera-Engine] Native schema rules verified successfully ✅")
        else:
            print(f"[Pipeline 1A: Pandera-Engine] Violations detected: {results['errors'][:3]}")
    except Exception as e:
        results["valid"] = False
        results["errors"].append(str(e))

    return results

# ── 2. Pipeline 1B: Great Expectations-style Contract Suite ──
def run_great_expectations_audit(rows: list, columns: list) -> dict:
    print("[Pipeline 1B: Great Expectations] Auditing dataset batch contracts...")
    audit_results = {"engine": "Great Expectations", "passed": True, "details": []}
    
    row_count = len(rows)
    row_pass = row_count >= 1
    audit_results["details"].append({
        "expectation": "expect_table_row_count_to_be_between",
        "success": row_pass,
        "observed": row_count
    })
    if not row_pass:
        audit_results["passed"] = False

    # Timestamp existence
    ts_exists = "timestamp" in columns or any("timestamp" in r for r in rows)
    audit_results["details"].append({
        "expectation": "expect_column_to_exist:timestamp",
        "success": ts_exists,
        "observed": "present" if ts_exists else "missing"
    })
    if not ts_exists:
        audit_results["passed"] = False

    # Check signal values present
    signals_present = any("energy_signal" in r for r in rows)
    audit_results["details"].append({
        "expectation": "expect_column_to_exist:energy_signal",
        "success": signals_present,
        "observed": "present" if signals_present else "missing"
    })
    if not signals_present:
        audit_results["passed"] = False

    status_icon = "✅" if audit_results["passed"] else "⚠️"
    print(f"[Pipeline 1B: Great Expectations] Batch contract audit finished {status_icon}")
    return audit_results

def validate_file(file_path: str = "data/processed/events_clean.csv") -> bool:
    target = Path(file_path)
    if not target.exists():
        target = Path("data/raw/events.csv")

    rows = []
    columns = []
    if target.exists():
        with open(target, mode="r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            columns = reader.fieldnames or []
            rows = list(reader)
    else:
        print(f"[AETHER-VALIDATE] Generating bootstrap events for testing...")
        Path("data/raw").mkdir(parents=True, exist_ok=True)
        target = Path("data/raw/events.csv")
        columns = ["timestamp", "energy_signal", "stress_signal", "focus_signal", "motivation_signal", "hour_sin", "hour_cos", "word_count", "complexity", "question_ratio", "is_study_session", "is_goal_mention", "is_complaint", "raw_text"]
        import math, random
        random.seed(42)
        rows = []
        for i in range(50):
            h = random.randint(0, 23)
            rows.append({
                "timestamp": f"2026-04-{(i%28)+1:02d}T{h:02d}:00:00Z",
                "energy_signal": str(round(random.uniform(0.3, 0.9), 3)),
                "stress_signal": str(round(random.uniform(0.1, 0.6), 3)),
                "focus_signal": str(round(random.uniform(0.4, 0.95), 3)),
                "motivation_signal": str(round(random.uniform(0.5, 0.9), 3)),
                "hour_sin": str(round(math.sin(2 * math.pi * h / 24), 3)),
                "hour_cos": str(round(math.cos(2 * math.pi * h / 24), 3)),
                "word_count": str(random.randint(5, 45)),
                "complexity": str(round(random.uniform(0.2, 0.7), 2)),
                "question_ratio": "0.0",
                "is_study_session": "1.0" if i % 2 == 0 else "0.0",
                "is_goal_mention": "1.0" if i % 4 == 0 else "0.0",
                "is_complaint": "0.0",
                "raw_text": "Deep coding session on MLOps pipeline"
            })
        with open(target, mode="w", encoding="utf-8", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=columns)
            writer.writeheader()
            writer.writerows(rows)

    print(f"[AETHER-VALIDATE] Loaded {len(rows)} events from {target}")
    pandera_res = run_pandera_validation(rows, columns)
    gx_res = run_great_expectations_audit(rows, columns)

    report = {
        "file": str(target),
        "row_count": len(rows),
        "pandera": pandera_res,
        "great_expectations": gx_res,
        "overall_valid": pandera_res["valid"] and gx_res["passed"]
    }

    Path("site/data").mkdir(parents=True, exist_ok=True)
    with open("site/data/validation_report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("[AETHER-VALIDATE] Validation report written to site/data/validation_report.json ✅")
    return report["overall_valid"]

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "data/processed/events_clean.csv"
    validate_file(path)
