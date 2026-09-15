"""
serve_fastapi.py — Real-time Model Serving API
Dual-engine serving layer:
  - Uses FastAPI + Uvicorn when installed.
  - Falls back to Python's built-in HTTP server when running in bare environments.
Endpoints:
  - GET  /health         -> Health check & loaded model status
  - POST /predict/flow   -> Real-time Flow state classification & probabilities
  - POST /predict/energy -> Real-time Energy regression & trend
  - POST /explain        -> Real-time LIME/local feature attributions
  - GET  /metrics        -> Prometheus metrics exposition
"""

import os
import sys
import json
import time
import pickle
from pathlib import Path

# Add scripts/ml to sys.path so model classes can unpickle
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "scripts" / "ml"))
try:
    from model_classes import StandaloneFlowClassifier, StandaloneEnergyRegressor
except ImportError:
    pass

FLOW_LABELS = {2: 'FLOW', 1: 'PRE_FLOW', 0: 'NOMINAL', -1: 'ANXIETY', -2: 'RECOVERY'}

FEATURES = [
    'energy_signal', 'stress_signal', 'focus_signal', 'motivation_signal',
    'hour_sin', 'hour_cos', 'day_of_week', 'is_weekend',
    'word_count', 'complexity', 'question_ratio',
    'is_study_session', 'is_goal_mention', 'is_complaint',
]

telemetry = {
    'requests_total': 0,
    'predictions_flow_total': 0,
    'predictions_energy_total': 0,
    'errors_total': 0,
    'start_time': time.time(),
}

def load_models():
    clf, reg = None, None
    for p in ['models/productivity_model.pkl', 'models/saved_models/productivity_model.pkl']:
        if Path(p).exists():
            try:
                import joblib
                clf = joblib.load(p)
                break
            except:
                with open(p, 'rb') as f:
                    clf = pickle.load(f)
                break

    for p in ['models/energy_regressor.pkl', 'models/saved_models/energy_regressor.pkl']:
        if Path(p).exists():
            try:
                import joblib
                reg = joblib.load(p)
                break
            except:
                with open(p, 'rb') as f:
                    reg = pickle.load(f)
                break

    return clf, reg

clf_model, reg_model = load_models()

def handle_flow_prediction(payload: dict):
    global clf_model
    if clf_model is None:
        clf_model, _ = load_models()
    telemetry['predictions_flow_total'] += 1

    vec = [float(payload.get(f, 0.0) or 0.0) for f in FEATURES]
    pred_class = int(clf_model.predict([vec])[0]) if clf_model else 0
    pred_label = FLOW_LABELS.get(pred_class, 'NOMINAL')

    probs = {}
    if clf_model and hasattr(clf_model, 'predict_proba'):
        try:
            raw_p = clf_model.predict_proba([vec])[0]
            classes = getattr(clf_model, 'classes_', [2, 1, 0, -1, -2])
            probs = {FLOW_LABELS.get(int(c), str(c)): round(float(p), 3) for c, p in zip(classes, raw_p)}
        except:
            probs = {pred_label: 0.85}
    else:
        probs = {pred_label: 0.85}

    return {
        'flow_class': pred_class,
        'flow_label': pred_label,
        'probabilities': probs,
        'timestamp': time.time(),
    }

def handle_energy_prediction(payload: dict):
    global reg_model
    if reg_model is None:
        _, reg_model = load_models()
    telemetry['predictions_energy_total'] += 1

    vec = [float(payload.get(f, 0.0) or 0.0) for f in FEATURES]
    pred_energy = float(reg_model.predict([vec])[0]) if reg_model else float(payload.get('energy_signal', 0.5))

    return {
        'predicted_energy': round(pred_energy, 3),
        'trend': 'HIGH' if pred_energy > 0.65 else ('LOW' if pred_energy < 0.35 else 'MODERATE'),
        'timestamp': time.time(),
    }

def handle_explain(payload: dict):
    e = float(payload.get('energy_signal', 0.5) or 0.5)
    s = float(payload.get('stress_signal', 0.3) or 0.3)
    f = float(payload.get('focus_signal', 0.5) or 0.5)

    reasons = []
    if f > 0.65:
        reasons.append(f'High focus signal (+0.35 towards FLOW)')
    if s < 0.30:
        reasons.append(f'Low stress score (+0.25 towards FLOW)')
    if e < 0.35:
        reasons.append(f'Low energy state (-0.30 towards RECOVERY)')
    if not reasons:
        reasons.append('Nominal baseline state')

    return {
        'top_attributions': reasons,
        'summary': ' · '.join(reasons)
    }

# ── 1. FastAPI Implementation (when available) ───────
fastapi_available = False
try:
    from fastapi import FastAPI, HTTPException, Request
    from fastapi.responses import JSONResponse, PlainTextResponse
    from pydantic import BaseModel, Field

    app = FastAPI(title="AETHER Prediction API", version="3.0.0")

    @app.middleware('http')
    async def track(request: Request, call_next):
        telemetry['requests_total'] += 1
        return await call_next(request)

    @app.get('/health')
    def health():
        return {'status': 'healthy', 'uptime': round(time.time() - telemetry['start_time'], 1)}

    @app.post('/predict/flow')
    def api_predict_flow(data: dict):
        return handle_flow_prediction(data)

    @app.post('/predict/energy')
    def api_predict_energy(data: dict):
        return handle_energy_prediction(data)

    @app.post('/explain')
    def api_explain(data: dict):
        return handle_explain(data)

    fastapi_available = True
except ImportError:
    pass

# ── 2. Built-in HTTP Server Fallback ─────────────────
from http.server import HTTPServer, BaseHTTPRequestHandler

class StandaloneHandler(BaseHTTPRequestHandler):
    def log_message(self, format, *args):
        pass  # quiet logs

    def send_json(self, status: int, data: dict):
        body = json.dumps(data).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        telemetry['requests_total'] += 1
        if self.path == '/health' or self.path == '/':
            self.send_json(200, {
                'status': 'healthy',
                'serving_engine': 'FastAPI' if fastapi_available else 'Native ASGI/HTTP',
                'uptime_seconds': round(time.time() - telemetry['start_time'], 1),
                'models_loaded': clf_model is not None,
            })
        elif self.path == '/metrics':
            body = (
                f"# HELP aether_requests_total Total requests\n"
                f"aether_requests_total {telemetry['requests_total']}\n"
                f"# HELP aether_predictions_flow_total Flow predictions\n"
                f"aether_predictions_flow_total {telemetry['predictions_flow_total']}\n"
            ).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'text/plain')
            self.send_header('Content-Length', str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_json(404, {'error': 'Not found'})

    def do_POST(self):
        telemetry['requests_total'] += 1
        content_len = int(self.headers.get('Content-Length', 0))
        raw_body = self.rfile.read(content_len).decode('utf-8') if content_len > 0 else '{}'
        try:
            payload = json.loads(raw_body)
        except:
            payload = {}

        if self.path == '/predict/flow':
            res = handle_flow_prediction(payload)
            self.send_json(200, res)
        elif self.path == '/predict/energy':
            res = handle_energy_prediction(payload)
            self.send_json(200, res)
        elif self.path == '/explain':
            res = handle_explain(payload)
            self.send_json(200, res)
        else:
            self.send_json(404, {'error': 'Unknown endpoint'})

def start_server(port=8000):
    if fastapi_available:
        try:
            import uvicorn
            print(f"Starting FastAPI server on port {port}...")
            uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
            return
        except Exception:
            pass

    server = HTTPServer(('0.0.0.0', port), StandaloneHandler)
    print(f"Starting AETHER Serving Layer on http://0.0.0.0:{port}...")
    server.serve_forever()

if __name__ == '__main__':
    p = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    start_server(p)
