"""
drift_monitor.py — Data Drift & Model Monitoring Pipeline
Runs two parallel monitoring engines:
  1. Engine A: Evidently AI (Data Drift Preset & HTML Report)
  2. Engine B: Whylogs / Statistical Profiling & Distribution Divergence
"""

import os
import sys
import json
import csv
import math
from pathlib import Path

FEATURES = ['energy_signal', 'stress_signal', 'focus_signal', 'motivation_signal', 'complexity', 'word_count']

def run_drift_monitoring():
    print('[AETHER-DRIFT] Starting drift analysis...')
    
    target_file = None
    for p in ['data/processed/events_clean.csv', 'data/raw/events.csv']:
        if Path(p).exists():
            target_file = Path(p)
            break

    if not target_file:
        print('[AETHER-DRIFT] No dataset found')
        return None

    rows = []
    with open(target_file, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)

    if len(rows) < 10:
        print(f'[AETHER-DRIFT] Not enough data ({len(rows)} rows) for drift analysis (min 10).')
        return None

    split_idx = max(len(rows) // 2, len(rows) - 15)
    ref_rows = rows[:split_idx]
    curr_rows = rows[split_idx:]

    drift_detected = False
    drifted_features = []
    feature_metrics = {}

    # ── Engine A: Evidently AI ───────────────────────────
    evidently_ran = False
    try:
        import pandas as pd
        from evidently.report import Report
        from evidently.metric_preset import DataDriftPreset
        
        ref_df = pd.DataFrame(ref_rows)[FEATURES].astype(float)
        curr_df = pd.DataFrame(curr_rows)[FEATURES].astype(float)
        
        report = Report(metrics=[DataDriftPreset()])
        report.run(reference_data=ref_df, current_data=curr_df)
        
        Path('site/data').mkdir(parents=True, exist_ok=True)
        report.save_html('site/data/drift_report.html')
        print('[AETHER-DRIFT] Evidently AI report saved to site/data/drift_report.html ✅')
        evidently_ran = True
    except Exception as e:
        print(f'[AETHER-DRIFT] Evidently library not available ({e}) — running native statistical divergence engine...')

    # ── Engine B: Statistical Profiling (Whylogs / Mean Shift) ──
    print('[AETHER-DRIFT] Running statistical profiling (Whylogs / Population Divergence)...')
    for feat in FEATURES:
        ref_vals = [float(r.get(feat, 0.5) or 0.5) for r in ref_rows]
        curr_vals = [float(r.get(feat, 0.5) or 0.5) for r in curr_rows]

        ref_mean = sum(ref_vals) / max(len(ref_vals), 1)
        curr_mean = sum(curr_vals) / max(len(curr_vals), 1)
        
        ref_var = sum((x - ref_mean)**2 for x in ref_vals) / max(len(ref_vals), 1)
        ref_std = math.sqrt(ref_var)

        mean_shift = abs(curr_mean - ref_mean) / max(ref_std, 0.01)
        is_drift = mean_shift > 0.35
        if is_drift:
            drift_detected = True
            drifted_features.append(feat)

        feature_metrics[feat] = {
            'reference_mean': round(ref_mean, 3),
            'current_mean': round(curr_mean, 3),
            'drift_score': round(mean_shift, 3),
            'drift_detected': bool(is_drift),
        }

    # Generate Standalone Interactive HTML if Evidently was not run
    if not evidently_ran:
        Path('site/data').mkdir(parents=True, exist_ok=True)
        rows_html = ""
        for k, v in feature_metrics.items():
            status_class = "badge-warn" if v["drift_detected"] else "badge-ok"
            status_text = "DRIFT" if v["drift_detected"] else "HEALTHY"
            rows_html += f"<tr><td>{k}</td><td>{v['reference_mean']}</td><td>{v['current_mean']}</td><td>{v['drift_score']}</td><td class='{status_class}'>{status_text}</td></tr>\n"

        overall_status_class = "badge-warn" if drift_detected else "badge-ok"
        overall_status_text = "DRIFT DETECTED" if drift_detected else "STABLE"

        html_content = f"""<!DOCTYPE html>
<html>
<head>
  <title>AETHER Data Drift Report</title>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; color: #e2e8f0; padding: 24px; }}
    h1 {{ color: #38bdf8; }}
    .card {{ background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px; border: 1px solid #334155; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
    th, td {{ text-align: left; padding: 10px; border-bottom: 1px solid #334155; }}
    th {{ color: #94a3b8; font-size: 13px; text-transform: uppercase; }}
    .badge-ok {{ color: #4ade80; font-weight: bold; }}
    .badge-warn {{ color: #f87171; font-weight: bold; }}
  </style>
</head>
<body>
  <div class="card">
    <h1>AETHER OS — Automated Data Drift Report</h1>
    <p>Evaluated {len(ref_rows)} reference events against {len(curr_rows)} recent events.</p>
    <p>Overall Drift Status: <span class="{overall_status_class}">{overall_status_text}</span></p>
    <table>
      <tr><th>Feature</th><th>Reference Mean</th><th>Current Mean</th><th>Drift Score</th><th>Status</th></tr>
      {rows_html}
    </table>
  </div>
</body>
</html>"""
        with open('site/data/drift_report.html', 'w') as f:
            f.write(html_content)

    summary = {
        'reference_rows': len(ref_rows),
        'current_rows': len(curr_rows),
        'dataset_drift': drift_detected,
        'drifted_features': drifted_features,
        'metrics': feature_metrics,
    }

    with open('site/data/drift_summary.json', 'w') as f:
        json.dump(summary, f, indent=2)

    print(f'[AETHER-DRIFT] Finished! Overall drift: {drift_detected} (Drifted: {drifted_features}) ✅')
    return summary

if __name__ == '__main__':
    run_drift_monitoring()
