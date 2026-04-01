# AETHER OS - DevOps & MLOps Pipeline Documentation

This document outlines the full end-to-end architecture, DevOps automation, and Machine Learning Operations (MLOps) pipeline that power the AETHER OS (JARVIS NEXUS) dashboard and Telegram bot.

---

## 🏗️ 1. High-Level Architecture Overview

AETHER OS consists of interconnected systems designed to act as a personal productivity and "flow state" tracker with ML-based feedback:

1. **Input Layer:** Telegram Bot, Direct Dashboard Web Log, Automated GitHub Activity.
2. **API & Edge State (Brain):** Cloudflare Worker serving the API and interacting with Cloudflare KV storage.
3. **Frontend (UI):** Cloudflare Pages hosting the HTML/CSS/JS JARVIS-themed Dashboard.
4. **DevOps/Automations:** GitHub Actions running deployments and listening to coding activity.
5. **Continuous MLOps Pipeline:** Nightly scheduled GitHub Action that extracts, cleans, trains ML models, tracks experiments via DagsHub (MLflow), generates predictions, and syncs back to the Edge.

---

## 🛠️ 2. DevOps Pipeline

The traditional DevOps components involve continuous integration, deployment, and automated activity tracking.

### A. Environment & Deployment (`deploy.yml`)
- **Trigger:** Push to `master` branch.
- **Action:** Runs `wrangler deploy --env=""` to seamlessly update the `api/worker.js` Cloudflare Worker.
- Ensures the API logic and webhook handlers are always up-to-date with zero downtime.

### B. Automated GitHub Activity Logger (`github_activity.yml`)
- **Trigger:** Push to `master`/`main` or merged Pull Requests.
- **Action:** When code is pushed, the workflow parses the commit message, files changed, additions, and deletions.
- **Heuristics:** Uses regex on the commit message to assign an `energy_signal` (e.g., `feat` = High Energy 0.8, `docs` = Medium Energy 0.5) and a `topic`.
- **Ingestion:** Posts an automated "study/code session" directly to the Cloudflare Worker (`/log-github`). 
- **Purpose:** Collects zero-effort, passive telemetry on coding productivity.

### C. Code Graph Generation (`code_graph.yml`)
- **Action:** Uses `GitNexus` to analyze code structures. Builds `code_graph.json` representing structural relationships.
- Copies the graph to `site/data/` so the frontend UI can visualize the "Neural Nexus".
- Commits changes back to the repo automatically.

---

## 🧠 3. MLOps Pipeline 

The core intelligence of AETHER resides in its batch MLOps pipeline, organized in `.github/workflows/ml_pipeline.yml`.

**Trigger:** Runs nightly (1:00 AM IST) or via manual/repository dispatch.

### Step-by-Step ML Lifecycle

1. **Extraction (Data Pull)**
   - Script: `scripts/pipeline/pull_events.py`
   - Action: Queries the Cloudflare Worker `/events` endpoint to pull the latest interactions logged in KV storage.
   - Output: Saves raw logs to `data/raw/events.csv`.

2. **Data Cleaning & Preprocessing**
   - Script: `scripts/pipeline/data_cleaner.py`
   - Action: 
     - Detects and drops "gibberish" inputs (e.g., keyboard mashes, invalid characters).
     - Standardizes timestamps and sorts chronologically.
     - Removes duplicate traces and drops invalid/failed NLP text events.
     - Imputes missing signals (energy, stress, focus).
   - Output: Generates a mature training set at `data/processed/events_clean.csv`.

3. **Feature Engineering & Model Training**
   - Script: `scripts/ml/train_models.py`
   - Features Engineered: Time-based sinusoids (`hour_sin`, `hour_cos`), weekend booleans, text complexity, word count.
   - **Labeling Logic:** Automatically constructs a `flow_class` label (Flow, Pre-Flow, Nominal, Anxiety, Recovery) based on deterministic thresholds of energy/stress/focus arrays to train the ML against.
   - **Models:** 
     - `RandomForestClassifier`: Predicts Flow State.
     - `GradientBoostingRegressor`: Predicts Energy Levels.
   - **MLflow / DagsHub Tracking:** Connects to DagsHub via `DAGSHUB_TOKEN`. Logs experiment parameters (estimators, depth), metrics (RF accuracy, RMSE, Cross-Validation score), feature importances, and versioned artifacts (`.pkl` models) to the remote tracking server.
   - Output: Serialized models placed in `models/`.

4. **Inference & Prediction Generation**
   - Script: `scripts/ml/predict.py`
   - Action: Loads `productivity_model.pkl`. Processes the last 30 events, injects features, and infers the active **Flow Probability**, **Focus state**, and the user's **Peak Productivity Hour**.
   - Output: Dumps an aggregate state json at `site/data/dashboard.json`.

5. **Analytics & Logic Engines**
   The pipeline triggers offline metric engines to compute human-readable visualizations:
   - **Insight Engine (`insight_engine.py`):** Calculates human-readable warnings and boosts (e.g., "High focus detected").
   - **Pattern Engine (`pattern_engine.py`):** Correlates behaviors (e.g., weekday vs. weekend energy variance).
   - **Habit Tracker (`habit_tracker.py`):** Computes activity streaks per topic.
   - **Memory Graph (`memory_graph_builder.py`):** Creates node-edge maps of the user's interaction history for UI neural visualization.

6. **Edge Synchronization (Push Dashboard)**
   - Script: `scripts/pipeline/push_dashboard.py`
   - Action: Takes the generated `dashboard.json` offline inferences and POSTs them back up to the Cloudflare Worker API `/update-dashboard`. This ensures the live edge network and UI render near-time valid ML data without waiting for the frontend to re-calculate states.

7. **Artifact Commit**
   - Action: The GitHub Actions runner commits `data/raw/`, `data/processed/`, tracking stats, and `site/data/` JSONs back to the repository (`[skip ci]`). This inherently versions the data dataset and creates a Git-backed data warehouse.

---

## 🚀 Summary of Data Flow

1. **User interacts** via TG / UI / IDE (Git Commit).
2. **CF Worker API** catches event, stores in KV.
3. Every night, **GH Actions (`ml_pipeline.yml`)** wakes up.
4. GH retrieves KV dump → Cleans → Engineers Features.
5. Scikit-learn **trains** Classifier/Regressor.
6. **DagsHub** logs metrics and artifacts.
7. Model **Predicts** today's flow state / peak hour.
8. GH **Pushes** JSON aggregate back to CF Worker API.
9. **UI** requests `/dashboard` API from Worker and displays trained predictions.
