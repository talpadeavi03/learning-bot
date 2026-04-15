"""
AETHER OS — push_dashboard.py
Reads ML predictions → writes to Supabase state table + Cloudflare KV
"""
import os, sys, json
from pathlib import Path
from datetime import date

import pandas as pd
from dotenv import load_dotenv

load_dotenv()
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from scripts.db.supabase_client import upsert_state, insert_insight, get_client

PREDICTIONS_PATH  = Path("data/processed/predictions.json")
INSIGHTS_PATH     = Path("data/insights/latest.json")
DASHBOARD_PATH    = Path("data/processed/dashboard.json")

def push():
    print("[push_dashboard] Reading prediction outputs...")

    dashboard = {}

    if PREDICTIONS_PATH.exists():
        with open(PREDICTIONS_PATH) as f:
            predictions = json.load(f)
        dashboard.update(predictions)
        print(f"[push_dashboard] Loaded predictions: {list(predictions.keys())}")

    if DASHBOARD_PATH.exists():
        with open(DASHBOARD_PATH) as f:
            dashboard.update(json.load(f))

    # Build state row
    state_row = {
        "date":           str(date.today()),
        "energy":         int(dashboard.get("avg_energy", 50)),
        "focus":          int(dashboard.get("avg_focus",  50)),
        "stress":         int(dashboard.get("avg_stress", 20)),
        "flow_class":     dashboard.get("flow_label", "NOMINAL"),
        "flow_prob":      float(dashboard.get("flow_prob", 0.2)),
        "level":          int(dashboard.get("level", 1)),
        "xp":             int(dashboard.get("xp", 0)),
        "streak":         int(dashboard.get("streak", 0)),
        "solo_stats":     dashboard.get("soloStats", {}),
        "life_dimensions":dashboard.get("lifeDimensions", {}),
        "negatives":      dashboard.get("negatives", {}),
        "int_stat":       int(dashboard.get("soloStats", {}).get("INT", 0)),
        "str":            int(dashboard.get("soloStats", {}).get("STR", 0)),
        "vit":            int(dashboard.get("soloStats", {}).get("VIT", 0)),
        "agi":            int(dashboard.get("soloStats", {}).get("AGI", 0)),
        "sen":            int(dashboard.get("soloStats", {}).get("SEN", 0)),
        "updated_at":     "now()",
    }

    print("[push_dashboard] Writing state to Supabase...")
    upsert_state(state_row)
    print("[push_dashboard] State saved ✓")

    # Push insights if they exist
    if INSIGHTS_PATH.exists():
        with open(INSIGHTS_PATH) as f:
            insights = json.load(f)
        for ins in insights[:5]:
            try:
                insert_insight(ins)
            except Exception as e:
                print(f"[push_dashboard] Insight insert warning: {e}")
        print(f"[push_dashboard] {len(insights)} insights saved ✓")

    # Also push to Cloudflare KV if token available
    _push_to_kv(dashboard)

def _push_to_kv(dashboard: dict):
    account_id  = os.environ.get("CLOUDFLARE_KV_ACCOUNT_ID")
    namespace   = os.environ.get("CLOUDFLARE_KV_NAMESPACE_ID")
    api_token   = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not all([account_id, namespace, api_token]):
        print("[push_dashboard] No CF credentials — skipping KV push")
        return
    import urllib.request
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace}/values/dashboard:latest"
    data = json.dumps(dashboard).encode()
    req = urllib.request.Request(url, data=data, method="PUT",
        headers={"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        print(f"[push_dashboard] KV push status: {r.status} ✓")

if __name__ == "__main__":
    push()
