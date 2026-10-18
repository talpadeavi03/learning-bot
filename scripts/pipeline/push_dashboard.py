"""
AETHER OS — push_dashboard.py
Reads ML predictions → writes to Supabase state table + Cloudflare KV / Worker API
"""
import os
import sys
import json
import urllib.request
from pathlib import Path
from datetime import date
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass
sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent))

# Preferred and fallback paths
DASHBOARD_PATHS = [
    Path("site/data/dashboard.json"),
    Path("data/processed/dashboard.json"),
    Path("data/processed/predictions.json")
]

INSIGHTS_PATHS = [
    Path("site/data/insights.json"),
    Path("data/insights/latest.json")
]

def load_dashboard_state() -> dict:
    dashboard = {}
    for p in DASHBOARD_PATHS:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict):
                        dashboard.update(data)
                        print(f"[push_dashboard] Loaded state from {p}")
            except Exception as e:
                print(f"[push_dashboard] Warning loading {p}: {e}")
    return dashboard

def load_insights() -> list:
    for p in INSIGHTS_PATHS:
        if p.exists():
            try:
                with open(p, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    if isinstance(data, dict) and "insights" in data:
                        return data["insights"]
                    elif isinstance(data, list):
                        return data
            except Exception as e:
                print(f"[push_dashboard] Warning loading {p}: {e}")
    return []

def push():
    print("[push_dashboard] Reading prediction outputs...")
    dashboard = load_dashboard_state()
    insights = load_insights()

    avg_e = dashboard.get("avg_energy", 0.5)
    avg_f = dashboard.get("avg_focus", 0.5)
    avg_s = dashboard.get("avg_stress", 0.2)

    # Normalize energy, focus, stress to 0-100 integers
    e_val = int(round(float(avg_e) * 100)) if float(avg_e) <= 1.0 else int(avg_e)
    f_val = int(round(float(avg_f) * 100)) if float(avg_f) <= 1.0 else int(avg_f)
    s_val = int(round(float(avg_s) * 100)) if float(avg_s) <= 1.0 else int(avg_s)

    flow_label = dashboard.get("flow_state") or dashboard.get("flow_label") or "NOMINAL"
    flow_prob = float(dashboard.get("flow_probability") or dashboard.get("flow_prob") or 0.2)

    solo_stats = dashboard.get("soloStats") or {
        "INT": min(100, f_val),
        "STR": min(100, e_val),
        "VIT": min(100, e_val),
        "AGI": min(100, max(0, 100 - s_val)),
        "SEN": min(100, int((1.0 - float(avg_s if float(avg_s) <= 1.0 else avg_s / 100)) * 100))
    }

    state_row = {
        "date": str(date.today()),
        "energy": e_val,
        "focus": f_val,
        "stress": s_val,
        "flow_class": flow_label,
        "flow_prob": flow_prob,
        "level": int(dashboard.get("level", max(1, (e_val + f_val) // 20))),
        "xp": int(dashboard.get("xp", (e_val + f_val) * 10)),
        "streak": int(dashboard.get("streak", 1)),
        "solo_stats": solo_stats,
        "life_dimensions": dashboard.get("lifeDimensions", {}),
        "negatives": dashboard.get("negatives", {}),
        "int_stat": int(solo_stats.get("INT", 0)),
        "str": int(solo_stats.get("STR", 0)),
        "vit": int(solo_stats.get("VIT", 0)),
        "agi": int(solo_stats.get("AGI", 0)),
        "sen": int(solo_stats.get("SEN", 0)),
        "updated_at": "now()",
    }

    # 1. Supabase Sync (if configured)
    try:
        from scripts.db.supabase_client import upsert_state, insert_insight
        print("[push_dashboard] Writing state to Supabase...")
        upsert_state(state_row)
        print("[push_dashboard] State saved to Supabase ✓")

        for ins in insights[:5]:
            try:
                insert_insight(ins if isinstance(ins, dict) else {"text": str(ins)})
            except Exception as e:
                print(f"[push_dashboard] Insight insert warning: {e}")
        if insights:
            print(f"[push_dashboard] {len(insights[:5])} insights saved to Supabase ✓")
    except Exception as e:
        print(f"[push_dashboard] Supabase sync skipped or failed (non-fatal): {e}")

    # 2. Worker /update-dashboard Endpoint Sync
    _push_to_worker(dashboard)

    # 3. Direct Cloudflare KV Sync (if Cloudflare tokens provided)
    _push_to_kv(dashboard)

def _push_to_worker(dashboard: dict):
    worker_url = os.environ.get("WORKER_URL")
    if not worker_url:
        return

    admin_key = os.environ.get("ADMIN_KEY") or os.environ.get("X_ADMIN_KEY", "")
    target_url = f"{worker_url.rstrip('/')}/update-dashboard"
    headers = {"Content-Type": "application/json"}
    if admin_key:
        headers["X-Admin-Key"] = admin_key

    try:
        data = json.dumps(dashboard).encode("utf-8")
        req = urllib.request.Request(target_url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"[push_dashboard] Worker /update-dashboard status: {r.status} ✓")
    except Exception as e:
        print(f"[push_dashboard] Worker /update-dashboard sync skipped: {e}")

def _push_to_kv(dashboard: dict):
    account_id = os.environ.get("CLOUDFLARE_KV_ACCOUNT_ID")
    namespace = os.environ.get("CLOUDFLARE_KV_NAMESPACE_ID")
    api_token = os.environ.get("CLOUDFLARE_API_TOKEN")
    if not all([account_id, namespace, api_token]):
        return
    url = f"https://api.cloudflare.com/client/v4/accounts/{account_id}/storage/kv/namespaces/{namespace}/values/dashboard:latest"
    data = json.dumps(dashboard).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="PUT",
        headers={"Authorization": f"Bearer {api_token}", "Content-Type": "application/json"}
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            print(f"[push_dashboard] Cloudflare KV direct push status: {r.status} ✓")
    except Exception as e:
        print(f"[push_dashboard] Cloudflare KV push error: {e}")

if __name__ == "__main__":
    push()
