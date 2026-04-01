# AETHER OS — Complete System Documentation
> **Version**: 3.0 · **Updated**: April 2026 · **Author**: Avi Talpade
> **Personal AI Operating System — Zero Cost · Production Ready**

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture Diagram](#architecture-diagram)
3. [PWA Status & Android Install](#pwa-status--android-install)
4. [Live URLs & Deployment](#live-urls--deployment)
5. [Directory Structure](#directory-structure)
6. [All Pipelines (CI/CD)](#all-pipelines-cicd)
7. [ML Model Training & Prediction](#ml-model-training--prediction)
8. [API Worker — All Routes](#api-worker--all-routes)
9. [Telegram Bot — All Commands](#telegram-bot--all-commands)
10. [Data Flow & Storage](#data-flow--storage)
11. [Scripts Inventory](#scripts-inventory)
12. [Secrets & Environment Variables](#secrets--environment-variables)
13. [Zero-Cost Stack](#zero-cost-stack)
14. [PWA Audit & Fixes Applied](#pwa-audit--fixes-applied)
15. [Pipeline Test Results](#pipeline-test-results)
16. [Side Branch Plan — Real Data, MCP, APIs, Agents, Automations](#side-branch-plan)
17. [Roadmap](#roadmap)
18. [Troubleshooting](#troubleshooting)

---

## Project Overview

AETHER OS (codename: **JARVIS NEXUS**) is a **personal AI operating system** that tracks behavior, predicts flow states, and provides productivity intelligence — all at **zero cost** using free-tier cloud services.

### Core Capabilities
| Capability | Technology | Status |
|---|---|---|
| Behavior Tracking | Telegram Bot + NLP | ✅ Live |
| Flow State Prediction | RandomForest + GBM ML | ✅ Live |
| AI Chat (JARVIS) | Cloudflare Workers AI (Llama 3) | ✅ Live |
| Voice Notes | Whisper (CF AI) | ✅ Live |
| Image Analysis | LLaVA 1.5 7B (CF AI) | ✅ Live |
| Nightly ML Pipeline | GitHub Actions | ✅ Live |
| Auto GitHub Activity Log | GitHub Actions | ✅ Live |
| Code Graph / System Brain | GitNexus + GitHub Actions | ✅ Live |
| PWA (Installable) | Service Worker + Manifest | ✅ Fixed |
| Health/Finance/Career Tracking | Telegram Commands | ✅ Live |
| Morning/Evening Briefings | Cron Triggers (3x day) | ✅ Live |
| MLflow Experiment Tracking | DagsHub | ✅ Configured |

---

## Architecture Diagram

```
┌────────────────────────────────────────────────────────────────────┐
│                         INPUTS                                     │
│  Telegram Messages · GitHub Pushes · Goals · Check-ins · Images    │
│  Voice Notes · Documents · Mood/Sleep/Exercise/Spend Logs          │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│              INGESTION LAYER — Cloudflare Worker                   │
│  api/worker.js — 18+ routes                                       │
│  NLP Parser (Llama 3 8B) · Feature Extraction (22 features)       │
│  Voice (Whisper) · Vision (LLaVA 1.5 7B)                          │
│  saveEvent() → KV · triggerMLPipeline() → GitHub Actions           │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
          ┌───────────────┼───────────────┐
          ▼               ▼               ▼
┌──────────────┐  ┌──────────────┐  ┌──────────────────┐
│ Cloudflare KV│  │ GitHub Repo  │  │ Telegram Bot API │
│ events:list  │  │ data/raw/    │  │ Responses +      │
│ state:date   │  │ models/      │  │ Briefings        │
│ dashboard:   │  │ site/data/   │  │ 3x daily crons   │
│ goals:       │  └──────┬───────┘  └──────────────────┘
└──────────────┘         │
                         ▼
┌────────────────────────────────────────────────────────────────────┐
│              ML PIPELINE — GitHub Actions (Nightly)                 │
│  pull_events.py → data_cleaner.py → train_models.py                │
│  → predict.py → insight_engine.py → pattern_engine.py              │
│  → habit_tracker.py → memory_graph_builder.py                      │
│  → push_dashboard.py                                               │
│                                                                    │
│  MLflow → DagsHub (experiment tracking)                            │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          ▼
┌────────────────────────────────────────────────────────────────────┐
│              OUTPUT LAYER                                          │
│  dashboard.json · insights.json · patterns.json · habits.json     │
│  → CF KV (via push_dashboard.py)                                   │
│  → Dashboard PWA (site/index.html)                                 │
│  → Telegram Bot (morning/evening briefings)                        │
└────────────────────────────────────────────────────────────────────┘
```

---

## PWA Status & Android Install

### ✅ PWA is ENABLED — Installable on Android

| PWA Requirement | Status | Details |
|---|---|---|
| `manifest.json` | ✅ Present | `/site/manifest.json` — name, icons, start_url, display:standalone |
| Manifest linked in HTML | ✅ `<link rel="manifest">` | Line 4 of index.html |
| Service Worker file | ✅ Present | `/site/sw.js` (copied from `site/data/sw.js`) |
| SW Registration | ✅ In index.html | Lines 1289-1294 — `navigator.serviceWorker.register('/site/sw.js')` |
| Icons (192x192) | ✅ Present | `/site/icons/icon-192.png` |
| Icons (512x512) | ✅ Present | `/site/icons/icon-512.png` |
| `theme-color` meta | ✅ `#00ffff` | Cyan theme |
| `display: standalone` | ✅ | Hides browser chrome |
| HTTPS | ✅ | Cloudflare Pages auto-SSL |
| `mobile-web-app-capable` | ✅ Added | Chrome Android install support |
| `apple-mobile-web-app-capable` | ✅ Added | iOS Add to Home Screen |
| `apple-touch-icon` | ✅ Added | iOS icon |
| Offline support | ✅ | SW caches static assets + offline fallback |
| Background sync | ✅ | Queues events when offline |
| Push notifications | ✅ | SW handles push events |

### How to Install on Android
1. Open `https://learning-bot.pages.dev` in Chrome
2. Tap the **⋮** menu → "Add to Home Screen" or "Install app"
3. Chrome may also show an automatic install banner
4. The app opens fullscreen (standalone mode) with the AETHER icon

### Service Worker Features
- **Offline caching**: Static assets cached for offline use
- **Cache-first strategy**: Fast loads from cache, network updates
- **Background sync**: Queues events when offline, syncs when back online
- **Push notifications**: Full push notification support with action buttons
- **IndexedDB offline queue**: Events stored locally when offline

### ⚠️ Previous Issue (Fixed)
The service worker was located at `site/data/sw.js` but the HTML registered `/site/sw.js`. This has been fixed by copying `sw.js` to the correct location at `site/sw.js`.

---

## Live URLs & Deployment

| Service | URL | Status |
|---|---|---|
| **Frontend Dashboard** | https://learning-bot.pages.dev | ✅ LIVE |
| **API Worker** | https://learning-bot.talpadeavi0303.workers.dev | ✅ LIVE |
| **Health Check** | https://learning-bot.talpadeavi0303.workers.dev/health | ✅ LIVE |
| **Dashboard API** | https://learning-bot.talpadeavi0303.workers.dev/dashboard | ✅ LIVE |
| **Events API** | https://learning-bot.talpadeavi0303.workers.dev/events | ✅ LIVE |
| **GitHub Repo** | https://github.com/talpadeavi03/learning-bot | ✅ LIVE |
| **MLflow (DagsHub)** | https://dagshub.com/talpadeavi03/learning-bot.mlflow | ✅ Configured |

### Deprecated URLs (not used)
- `aether-api.talpadeavi0303.workers.dev` — old worker name
- `bot-webhook.talpadeavi0303.workers.dev` — bypassed (direct webhook)

---

## Directory Structure

```
learning-bot/
├── api/
│   └── worker.js                    ← THE BRAIN — 1900+ lines, 18+ routes, NLP, cron, all logic
│
├── site/                            ← Cloudflare Pages root (served as static assets)
│   ├── index.html                   ← Dashboard PWA (~1300 lines, full JARVIS UI)
│   ├── index-latest.html            ← Backup/latest version
│   ├── index.html.bk                ← Backup
│   ├── manifest.json                ← PWA manifest (installable app config)
│   ├── sw.js                        ← Service Worker (offline + push + background sync)
│   ├── system-brain.html            ← System brain viewer
│   ├── timeline.html                ← Timeline viewer
│   ├── icons/
│   │   ├── icon-192.png             ← PWA icon (192x192)
│   │   └── icon-512.png             ← PWA icon (512x512)
│   └── data/
│       ├── dashboard.json           ← ML predictions (auto-generated)
│       ├── insights.json            ← AI insights (auto-generated)
│       ├── patterns.json            ← Behavior patterns (auto-generated)
│       ├── habits.json              ← Habit tracking data
│       ├── code_graph.json          ← System brain graph
│       ├── daily_plan.json          ← Daily plan
│       ├── state.json               ← Current state
│       ├── sw.js                    ← Service Worker (legacy location)
│       └── aether_response.json     ← AI response cache
│
├── scripts/
│   ├── pipeline/                    ← Data pipeline scripts
│   │   ├── pull_events.py           ← Pull events from CF Worker → CSV
│   │   ├── data_cleaner.py          ← Clean + validate event data
│   │   ├── push_dashboard.py        ← Push dashboard.json → CF KV
│   │   ├── push_code_graph.py       ← Push code graph → CF KV
│   │   ├── reset_data.py            ← Reset all data (dangerous)
│   │   └── run_pipeline.py          ← Full pipeline runner
│   │
│   ├── ml/                          ← Machine Learning
│   │   ├── train_models.py          ← Train RF classifier + GBM regressor (+ MLflow)
│   │   ├── predict.py               ← Generate predictions → dashboard.json
│   │   ├── generate_synthetic_data.py ← Generate synthetic training data
│   │   └── ai_summary.py            ← AI-powered summary generation
│   │
│   ├── features/                    ← Feature engineering
│   │   ├── feature_extractor.py     ← Extract behavioral features
│   │   ├── state_vector_builder.py  ← Build daily state vectors
│   │   └── daily_aggregator.py      ← Aggregate daily metrics
│   │
│   ├── analytics/                   ← Analytics & insight engines (20 scripts)
│   │   ├── insight_engine.py        ← Generate AI insights
│   │   ├── pattern_engine.py        ← Detect behavior patterns
│   │   ├── habit_tracker.py         ← Habit analysis
│   │   ├── memory_graph_builder.py  ← Build memory graph
│   │   ├── weekly_summary.py        ← Weekly summary generation
│   │   ├── dashboard_data.py        ← Dashboard data builder
│   │   ├── dashboard.py             ← Dashboard utilities
│   │   ├── goal_engine.py           ← Goal tracking engine
│   │   ├── task_planner.py          ← Task planning
│   │   ├── temporal_engine.py       ← Time-based analytics
│   │   ├── heatmap.py               ← Activity heatmap
│   │   ├── analytics.py             ← Core analytics module
│   │   ├── build_code_graph.js      ← CodeGraph builder (JS)
│   │   ├── build_code_graph.py      ← CodeGraph builder (Python)
│   │   ├── generate_architecture.py ← Architecture diagram generator
│   │   ├── knowledge_graph_builder.py ← Knowledge graph
│   │   ├── vector_memory_builder.py ← Vector embeddings
│   │   ├── vector_query.py          ← Vector search
│   │   ├── graph_query.py           ← Graph queries
│   │   └── insight_generator.py     ← Insight generator
│   │
│   ├── ingestion/                   ← Data ingestion
│   │   ├── nlp_parser.py            ← NLP event parser
│   │   ├── nlp_parser_ml.py         ← ML-enhanced NLP parser
│   │   └── tracker.py               ← Activity tracker
│   │
│   ├── ai/                          ← AI agent system
│   │   ├── aether_agent.py          ← Main AETHER agent
│   │   ├── agent_router.py          ← Route queries to appropriate agent
│   │   ├── context_builder.py       ← Build context for AI queries
│   │   ├── intent_classifier.py     ← Classify user intent
│   │   └── response_generator.py    ← Generate AI responses
│   │
│   └── realtime/                    ← Realtime processing
│       └── state_updater.py         ← Real-time state updates
│
├── data/
│   ├── raw/events.csv               ← All raw events (~100 events, 25KB)
│   ├── processed/events_clean.csv   ← Cleaned events (~100 events, 25KB)
│   ├── features/
│   │   ├── behavior_features.parquet ← Behavioral features
│   │   ├── daily_behavior.parquet   ← Daily behavior vectors
│   │   └── daily_state_vector.parquet ← State vectors (180 days synthetic)
│   ├── graph/memory_graph.json      ← Memory association graph
│   ├── insights/                    ← Generated insights (directory)
│   ├── vector/                      ← Vector embeddings (directory)
│   └── code_graph.json              ← Code dependency graph
│
├── models/
│   ├── productivity_model.pkl       ← Trained flow classifier (RF, 128KB)
│   ├── energy_regressor.pkl         ← Trained energy regressor (GBM, 184KB)
│   ├── training_stats.json          ← Latest training stats
│   └── saved_models/
│       └── productivity_model.pkl   ← Backup model (725KB)
│
├── .github/workflows/
│   ├── deploy.yml                   ← Auto-deploy on push to master
│   ├── ml_pipeline.yml              ← Nightly ML pipeline (1:00 AM IST)
│   ├── github_activity.yml          ← Auto-log GitHub commits as events
│   ├── ingest.yml                   ← Telegram batch ingestion
│   └── code_graph.yml               ← Build code dependency graph
│
├── docs/
│   ├── MASTER_PLAN.md               ← Full system plan & roadmap
│   ├── PROJECT_MAP.md               ← Quick reference for URLs & secrets
│   ├── all_details.md               ← THIS FILE — comprehensive documentation
│   ├── secrets.md                   ← Secrets reference
│   ├── aether-architecture.html     ← Interactive architecture diagram
│   ├── aether-progress.html         ← Progress tracker page
│   └── aether-vision.html           ← Vision & roadmap page
│
├── analytics/
│   ├── daily_insights.md            ← Daily insight reports
│   ├── dashboard.md                 ← Dashboard data summary
│   ├── heatmap.md                   ← Activity heatmap report
│   └── weekly-summary.md            ← Weekly summary
│
├── state/
│   ├── current_state.json           ← Current system state
│   ├── goals.json                   ← Active goals
│   └── last_update.txt              ← Last update timestamp
│
├── experiments/mlruns/              ← MLflow local experiment logs
├── wrangler.toml                    ← Cloudflare Worker config (KV + AI + crons)
├── package.json                     ← Node.js package (wrangler)
├── requirements-ml.txt              ← ML pipeline dependencies
├── requirements-analytics.txt       ← Analytics dependencies
├── requirements-ingest.txt          ← Full ingestion dependencies (pinned)
├── commands                         ← Quick command reference
├── readme.md                        ← Repo readme
└── tree.txt                         ← Full tree snapshot
```

---

## All Pipelines (CI/CD)

### 1. `deploy.yml` — Auto-Deploy Worker
- **Trigger**: Push to `master` or `main`
- **Action**: `wrangler deploy` → deploys `api/worker.js` + `site/` to Cloudflare
- **Secrets needed**: `CLOUDFLARE_API_TOKEN`

### 2. `ml_pipeline.yml` — Nightly ML Pipeline
- **Trigger**: Cron (`30 19 * * *` = 1:00 AM IST), manual, or `telegram_batch` dispatch
- **Timeout**: 20 minutes
- **Steps**:
  1. Checkout repo
  2. Setup Python 3.10
  3. Install `requirements-ml.txt` + `requirements-analytics.txt` + `mlflow`
  4. **Pull events** from Worker API → `data/raw/events.csv`
  5. **Clean data** → `data/processed/events_clean.csv`
  6. **Train models** → `models/productivity_model.pkl` + `models/energy_regressor.pkl` + MLflow → DagsHub
  7. **Predict** → `site/data/dashboard.json`
  8. **Generate insights** → `site/data/insights.json`
  9. **Pattern engine** → `site/data/patterns.json`
  10. **Habit tracker** → `site/data/habits.json`
  11. **Memory graph** → `data/graph/memory_graph.json`
  12. **Push dashboard** to Worker `/update-dashboard`
  13. **Commit** results back to repo
- **Secrets needed**: `DAGSHUB_TOKEN`

### 3. `github_activity.yml` — Auto Activity Logger
- **Trigger**: Push to `master`/`main`, Pull request closed
- **Action**: Logs every commit as a productivity event to AETHER Worker
- **Extracts**: commit message, files changed, additions, deletions
- **Energy estimation**: `feat/build` → 0.8, `fix/bug` → 0.7, `refactor` → 0.75, `chore/docs` → 0.5
- **Post to**: `POST /log-github` endpoint

### 4. `ingest.yml` — Telegram Batch Ingestion
- **Trigger**: `repository_dispatch` type `telegram_batch`
- **Action**: Receives batch events from Worker, runs NLP parser, commits outputs
- **Steps**: Save payload → `nlp_parser.py` → commit to repo

### 5. `code_graph.yml` — Build Code Graph
- **Trigger**: Push to `master` (paths: scripts/**, api/**, site/**), or manual
- **Action**: Uses GitNexus to analyze code dependencies → `code_graph.json`
- **Also runs**: `generate_architecture.py` → architecture diagram in docs

---

## ML Model Training & Prediction

### Models

| Model | File | Type | Purpose | Accuracy |
|---|---|---|---|---|
| **Flow Classifier** | `models/productivity_model.pkl` | RandomForest (100 trees, depth 8) | Predict flow state: FLOW / PRE_FLOW / NOMINAL / ANXIETY / RECOVERY | 100% train, 98.9% CV |
| **Energy Regressor** | `models/energy_regressor.pkl` | GradientBoosting (100 trees, depth 4) | Predict energy level (0-1) for next window | RMSE: ~0.00 |

### Features Used (14 total)
| Feature | Type | Description |
|---|---|---|
| `energy_signal` | Float 0-1 | NLP-extracted energy level |
| `stress_signal` | Float 0-1 | NLP-extracted stress level |
| `focus_signal` | Float 0-1 | NLP-extracted focus level |
| `motivation_signal` | Float 0-1 | NLP-extracted motivation level |
| `hour_sin` | Float | Cyclical hour encoding (sin) |
| `hour_cos` | Float | Cyclical hour encoding (cos) |
| `day_of_week` | Int 0-6 | Day of week |
| `is_weekend` | Bool | Weekend flag |
| `word_count` | Int | Message word count |
| `complexity` | Float 0-1 | Message complexity score |
| `question_ratio` | Float 0-1 | Question density |
| `is_study_session` | Bool | Whether it's a study session |
| `is_goal_mention` | Bool | Whether goals were mentioned |
| `is_complaint` | Bool | Whether it's a complaint |

### Training Data
- **Current**: ~100 events (95 used for training)
- **Source**: `data/processed/events_clean.csv` (preferred) or `data/raw/events.csv`
- **Target**: 30+ diverse events needed for reliable real-world predictions

### Top Features by Importance
1. `energy_signal` — 47.1%
2. `focus_signal` — 17.3%
3. `motivation_signal` — 15.0%
4. `is_study_session` — 11.6%
5. `stress_signal` — 4.4%

### Flow State Labels
| Code | Label | Criteria |
|---|---|---|
| 2 | FLOW | energy > 0.75 AND stress < 0.25 AND focus > 0.65 |
| 1 | PRE_FLOW | energy > 0.60 AND stress < 0.35 |
| 0 | NOMINAL | Default state |
| -1 | ANXIETY | stress > 0.65 |
| -2 | RECOVERY | energy < 0.30 |

### MLflow Integration
- **Tracking URI**: `https://dagshub.com/talpadeavi03/learning-bot.mlflow`
- **Experiment**: `aether-flow-classifier`
- **Logged metrics**: rf_train_accuracy, rf_cv_score, gbm_energy_rmse, flow distribution, feature importance
- **Logged artifacts**: flow_classifier model, energy_regressor model
- **Auth**: `DAGSHUB_TOKEN` environment variable

### Last Training Run
```json
{
  "n_events": 95,
  "n_features": 14,
  "rf_accuracy": 1.0,
  "cv_score": 0.989,
  "gbm_rmse": 0.000003,
  "trained_at": "2026-03-26T15:56:46",
  "flow_distribution": { "NOMINAL": 49, "PRE_FLOW": 32, "FLOW": 14 }
}
```

---

## API Worker — All Routes

### File: `api/worker.js` (~1900 lines)

| Method | Endpoint | Description |
|---|---|---|
| POST | `/webhook` | Telegram webhook — processes text, voice, image, document messages |
| POST | `/chat` | Dashboard AI chat (JARVIS) — hybrid/ML/AI engine selection |
| POST | `/log-state` | One-tap check-in widget |
| POST | `/log-github` | Auto-log GitHub commit events |
| POST | `/update-dashboard` | ML pipeline pushes dashboard.json to KV |
| POST | `/reset-data` | Reset all event data (dangerous) |
| POST | `/trigger` | Trigger automations (notion, spotify, nudge, checkin, webhook) |
| POST | `/update-code-graph` | Update code dependency graph in KV |
| GET | `/dashboard` | Get latest dashboard data for UI |
| GET | `/events` | Get raw events (for ML pipeline pull) |
| GET | `/health` | Health check |
| GET | `/knowledge` | Knowledge graph data |
| GET | `/code` | Query code graph (function lookup) |
| GET | `/codepath` | Trace function call paths |
| GET | `/api/*` | API status check |
| * | `/*` | Static assets via `env.ASSETS.fetch()` |

### Cron Triggers (wrangler.toml)
| UTC Time | IST Time | Action |
|---|---|---|
| 03:00 | 08:30 AM | Morning Briefing |
| 07:00 | 12:30 PM | Midday Nudge |
| 15:00 | 08:30 PM | Evening Summary |
| 15:00 (Sunday) | 08:30 PM | Weekly Report |

### AI Models Used (Cloudflare Workers AI — Free)
- **Llama 3 8B** — NLP parsing, chat, context understanding
- **Whisper** — Voice note transcription
- **LLaVA 1.5 7B** — Image/photo analysis

---

## Telegram Bot — All Commands

### Core Commands
| Command | Description |
|---|---|
| `/help` `/start` | List all commands |
| `/commands` | Full command reference with categories |
| `/stats` | Weekly performance summary (events, energy, stress, topics) |
| `/flow` | Current flow state ( FLOW / PRE_FLOW / NOMINAL / ANXIETY / RECOVERY) |
| `/goal [text]` | Set today's main goal |
| `/mood [1-5]` | Quick mood check-in (1=very low → 5=excellent) |
| `/week` | 7-day activity overview with bar chart |
| `/streak` | Current daily streak |
| `/morning` `/briefing` | Morning briefing |
| `/evening` `/summary` | Evening summary |

### Health Commands
| Command | Description |
|---|---|
| `/exercise [mins] [type]` | Log workout (default: 30min) |
| `/sleep [hours]` | Log sleep (calculates quality + energy) |
| `/food [description]` | Log meal |
| `/water [litres]` | Log water intake (default: 0.5L) |
| `/weight [kg]` | Log body weight |

### Finance Commands
| Command | Description |
|---|---|
| `/spend [amount] [category]` | Log expense |
| `/income [amount] [source]` | Log income |

### Career Commands
| Command | Description |
|---|---|
| `/job [company]` | Log job application |
| `/interview [company]` | Log interview |

### Developer Commands
| Command | Description |
|---|---|
| `/trace [function]` | Trace function call path in code graph |
| `/automate [action]` | Run automations (notion, spotify, nudge, checkin, webhook) |

### Natural Language
Any free-text message, voice note, or photo is automatically processed by the NLP engine — no command needed.

---

## Data Flow & Storage

### Event Lifecycle
```
User Input (Telegram / Dashboard / GitHub Push)
     │
     ▼
CF Worker receives → NLP Parse (Llama 3)
     │
     ├─→ Extract 22+ features (energy, stress, focus, motivation, sentiment, topics ...)
     │
     ├─→ saveEvent() → Cloudflare KV (events:list)
     │
     ├─→ Every 3-5 events → triggerMLPipeline() → GitHub Actions dispatch
     │
     └─→ Reply to user (Telegram / Chat)
     
     
GitHub Actions (nightly or triggered)
     │
     ├─→ pull_events.py → GET /events → data/raw/events.csv
     ├─→ data_cleaner.py → data/processed/events_clean.csv
     ├─→ train_models.py → models/*.pkl + MLflow → DagsHub
     ├─→ predict.py → site/data/dashboard.json
     ├─→ insight_engine.py → site/data/insights.json
     ├─→ pattern_engine.py → site/data/patterns.json
     ├─→ habit_tracker.py → site/data/habits.json
     ├─→ memory_graph_builder.py → data/graph/memory_graph.json
     ├─→ push_dashboard.py → POST /update-dashboard → CF KV
     └─→ git commit + push → triggers deploy.yml → Cloudflare Pages
```

### Storage Layers
| Store | Technology | Data |
|---|---|---|
| **Primary** | Cloudflare KV | Events, state, dashboard, goals, code_graph, knowledge_graph |
| **Secondary** | GitHub Repo | CSV files, models (.pkl), JSON data files |
| **ML Artifacts** | DagsHub MLflow | Experiment runs, model artifacts, metrics |
| **Feature Store** | Parquet files | `data/features/*.parquet` — daily behavior vectors |

### KV Keys
| Key | Description |
|---|---|
| `events:list` | JSON array of all events |
| `events:count` | Total event count |
| `state:YYYY-MM-DD` | Daily state snapshot |
| `dashboard:latest` | Latest dashboard data |
| `goal:YYYY-MM-DD` | Daily goal |
| `code_graph` | System brain graph |
| `knowledge_graph` | Knowledge associations |
| `chat:history` | Chat conversation history |

---

## Scripts Inventory

### Pipeline Scripts (6)
| Script | Purpose |
|---|---|
| `scripts/pipeline/pull_events.py` | Pull events from Worker API to CSV |
| `scripts/pipeline/data_cleaner.py` | Clean, validate, deduplicate events |
| `scripts/pipeline/push_dashboard.py` | Push dashboard.json to Worker KV |
| `scripts/pipeline/push_code_graph.py` | Push code graph to Worker KV |
| `scripts/pipeline/reset_data.py` | Reset all data (caution!) |
| `scripts/pipeline/run_pipeline.py` | Run full pipeline locally |

### ML Scripts (4)
| Script | Purpose |
|---|---|
| `scripts/ml/train_models.py` | Train flow classifier + energy regressor + MLflow |
| `scripts/ml/predict.py` | Generate predictions → dashboard.json |
| `scripts/ml/generate_synthetic_data.py` | Generate 180 days synthetic training data |
| `scripts/ml/ai_summary.py` | Generate AI-powered summaries |

### Feature Engineering Scripts (3)
| Script | Purpose |
|---|---|
| `scripts/features/feature_extractor.py` | Extract behavioral features from events |
| `scripts/features/state_vector_builder.py` | Build daily state vectors |
| `scripts/features/daily_aggregator.py` | Aggregate daily metrics |

### Analytics Scripts (20)
| Script | Purpose |
|---|---|
| `scripts/analytics/insight_engine.py` | Generate insights (patterns, anomalies, recommendations) |
| `scripts/analytics/pattern_engine.py` | Detect behavior patterns |
| `scripts/analytics/habit_tracker.py` | Track and analyze habits |
| `scripts/analytics/memory_graph_builder.py` | Build memory association graph |
| `scripts/analytics/weekly_summary.py` | Generate weekly summaries |
| `scripts/analytics/dashboard.py` | Dashboard utility functions |
| `scripts/analytics/dashboard_data.py` | Build dashboard data |
| `scripts/analytics/goal_engine.py` | Goal tracking and analysis |
| `scripts/analytics/task_planner.py` | AI task planning |
| `scripts/analytics/temporal_engine.py` | Time-based analytics |
| `scripts/analytics/heatmap.py` | Activity heatmap generation |
| `scripts/analytics/analytics.py` | Core analytics module |
| `scripts/analytics/build_code_graph.js` | Build code graph (JavaScript) |
| `scripts/analytics/build_code_graph.py` | Build code graph (Python) |
| `scripts/analytics/generate_architecture.py` | Generate architecture diagram |
| `scripts/analytics/knowledge_graph_builder.py` | Build knowledge graph |
| `scripts/analytics/vector_memory_builder.py` | Build vector embeddings for semantic search |
| `scripts/analytics/vector_query.py` | Query vector memory |
| `scripts/analytics/graph_query.py` | Query graph data |
| `scripts/analytics/insight_generator.py` | Generate individual insights |

### Ingestion Scripts (3)
| Script | Purpose |
|---|---|
| `scripts/ingestion/nlp_parser.py` | Parse events with NLP features |
| `scripts/ingestion/nlp_parser_ml.py` | ML-enhanced NLP parser |
| `scripts/ingestion/tracker.py` | Activity tracker |

### AI Agent Scripts (5)
| Script | Purpose |
|---|---|
| `scripts/ai/aether_agent.py` | Main AETHER agent entry point |
| `scripts/ai/agent_router.py` | Route queries to appropriate handler |
| `scripts/ai/context_builder.py` | Build context for AI responses |
| `scripts/ai/intent_classifier.py` | Classify user query intent |
| `scripts/ai/response_generator.py` | Generate natural language responses |

### Realtime Scripts (1)
| Script | Purpose |
|---|---|
| `scripts/realtime/state_updater.py` | Update state in real-time |

---

## Secrets & Environment Variables

### Cloudflare Worker Environment Variables
| Variable | Purpose | Required |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Telegram Bot API token | ✅ Yes |
| `TELEGRAM_CHAT_ID` | Authorized chat ID (security filter) | ✅ Yes |
| `GITHUB_TOKEN` | Trigger ML pipeline via GitHub dispatch | ⚠️ Needed for auto-trigger |
| `NOTION_TOKEN` | Notion journal integration | Optional |
| `SPOTIFY_FLOW_PLAYLIST` | Auto-play focus playlist | Optional |

### GitHub Actions Secrets
| Secret | Purpose | Required |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Wrangler deploy to Cloudflare | ✅ Yes |
| `DAGSHUB_TOKEN` | MLflow experiment tracking on DagsHub | ⚠️ Needed for MLflow |
| `ANTHROPIC_API_KEY` | Not used yet (CF AI is free) | Optional |

### Wrangler Config (`wrangler.toml`)
```toml
name = "learning-bot"
main = "api/worker.js"
compatibility_date = "2025-03-20"

[assets]
directory = "./site"
binding = "ASSETS"

[[kv_namespaces]]
binding = "AETHER_KV"
id = "4154fa683ced47c9871d0b43dfbd7a54"

[ai]
binding = "AI"

[triggers]
crons = ["30 3 * * *", "30 7 * * *", "30 15 * * *"]
```

---

## Zero-Cost Stack

| Layer | Service | Free Tier | Usage |
|---|---|---|---|
| **Worker/API** | Cloudflare Workers | 100k req/day | All routes, NLP, cron |
| **Storage** | Cloudflare KV | 100k reads, 1k writes/day | Events, state, dashboard |
| **AI — NLP** | CF Llama 3 8B | Workers AI free | Parse messages |
| **AI — Voice** | CF Whisper | Workers AI free | Voice notes |
| **AI — Vision** | CF LLaVA 1.5 7B | Workers AI free | Photo analysis |
| **Frontend** | Cloudflare Pages | Unlimited | PWA dashboard |
| **CI/CD** | GitHub Actions | 2000 min/month | Deploy + ML |
| **Bot** | Telegram Bot API | Unlimited | Commands + briefings |
| **ML Tracking** | DagsHub MLflow | Free tier | Experiment tracking |
| **Vector Memory** | CF Vectorize | 5M vectors free | Semantic search (next) |
| **SQL** | CF D1 | 5GB free | Complex queries (next) |
| **Notebooks** | Google Colab | Free GPU | Model training (next) |

**Total monthly cost: $0**

---

## PWA Audit & Fixes Applied

### Audit Result (April 2026)

| Check | Before | After |
|---|---|---|
| manifest.json present | ✅ | ✅ |
| manifest linked in HTML | ✅ | ✅ |
| Service Worker at correct path | ❌ (was in `/site/data/sw.js`) | ✅ (now at `/site/sw.js`) |
| SW registration in HTML | ✅ (pointed to `/site/sw.js`) | ✅ |
| `theme-color` meta | ✅ | ✅ |
| `mobile-web-app-capable` | ❌ Missing | ✅ Added |
| `apple-mobile-web-app-capable` | ❌ Missing | ✅ Added |
| `apple-mobile-web-app-status-bar-style` | ❌ Missing | ✅ Added |
| `apple-mobile-web-app-title` | ❌ Missing | ✅ Added |
| `apple-touch-icon` | ❌ Missing | ✅ Added |
| Meta description | ❌ Missing | ✅ Added |
| HTTPS | ✅ (Cloudflare auto-SSL) | ✅ |
| 192px icon | ✅ | ✅ |
| 512px icon | ✅ | ✅ |
| Offline fallback | ✅ | ✅ |
| Background sync | ✅ | ✅ |
| Push notifications | ✅ | ✅ |

### Fixes Applied
1. **Copied `sw.js`** from `site/data/sw.js` → `site/sw.js` (correct path for registration)
2. **Added `mobile-web-app-capable`** meta tag for Chrome Android install prompt
3. **Added `apple-mobile-web-app-capable`** for iOS home screen support
4. **Added `apple-mobile-web-app-status-bar-style`** = black-translucent
5. **Added `apple-mobile-web-app-title`** = AETHER OS
6. **Added `apple-touch-icon`** pointing to icon-192.png
7. **Added `meta description`** for SEO

---

## Pipeline Test Results

### Current Data Status
| Data File | Records | Size | Status |
|---|---|---|---|
| `data/raw/events.csv` | ~100 events | 25KB | ✅ Has data |
| `data/processed/events_clean.csv` | ~100 events | 25KB | ✅ Cleaned |
| `data/features/behavior_features.parquet` | — | 4KB | ✅ Generated |
| `data/features/daily_behavior.parquet` | — | 4KB | ✅ Generated |
| `data/features/daily_state_vector.parquet` | 180 days | 8KB | ✅ Synthetic |
| `models/productivity_model.pkl` | — | 128KB | ✅ Trained |
| `models/energy_regressor.pkl` | — | 184KB | ✅ Trained |
| `site/data/dashboard.json` | — | 298B | ✅ Generated |
| `site/data/insights.json` | — | 585B | ✅ Generated |
| `site/data/patterns.json` | — | 103B | ✅ Generated |
| `site/data/habits.json` | — | 125B | ✅ Generated |
| `data/graph/memory_graph.json` | — | 2KB | ✅ Generated |

### Pipeline Health
| Pipeline | Last Run | Status | Notes |
|---|---|---|---|
| `deploy.yml` | On every push | ✅ Working | Auto-deploys to Cloudflare |
| `ml_pipeline.yml` | Nightly 1:00 AM IST | ✅ Working | Full ML pipeline with MLflow |
| `github_activity.yml` | On every push | ✅ Working | Auto-logs commits |
| `ingest.yml` | On dispatch | ✅ Working | Telegram batch processing |
| `code_graph.yml` | On code changes | ✅ Working | GitNexus analysis |

### ML Model Accuracy
| Metric | Value | Notes |
|---|---|---|
| RF Train Accuracy | 100.0% | Perfect on training data (small dataset) |
| RF Cross-Validation | 98.9% | 3-fold CV |
| GBM Energy RMSE | ~0.000003 | Near-zero error |
| Training Events Used | 95 | Need more diverse data |

### ⚠️ Note on Model Quality
The current models show near-perfect accuracy which indicates **overfitting on a small dataset**. This is expected — the models will become more robust and generalizable once you log 200+ diverse events covering different energy levels, topics, time windows, and activity types.

---

## Side Branch Plan

### Branch Strategy
```
master (production)
  │
  ├── Side branch: feature/real-data-integration
  │     ├── MCP (Model Context Protocol) integration
  │     ├── External API connections
  │     ├── Agent system enhancements
  │     └── Automation pipelines
  │
  └── Side branch: feature/advanced-ml
        ├── Real data collection improvements
        ├── Advanced ML models
        └── Multi-model ensemble
```

### MCP (Model Context Protocol) Integration Plan
| Component | Description | Priority |
|---|---|---|
| **MCP Server** | Expose AETHER data as MCP resources | High |
| **MCP Tools** | Let AI assistants query your behavior data | High |
| **MCP Resources** | events, dashboard, insights, goals, flow_state | High |
| **Implementation** | CF Worker endpoint `/mcp` with MCP protocol | Medium |

### External APIs to Connect
| API | Purpose | Free Tier |
|---|---|---|
| **Google Calendar** | Auto-block deep work windows | Yes |
| **Notion API** | Auto-journal daily entries | Yes |
| **Spotify API** | Auto-play flow playlists | Yes |
| **GitHub API** | Enhanced commit analytics | Yes |
| **WakaTime API** | Coding time tracking | Yes |
| **Todoist API** | Task management sync | Yes |
| **OpenWeatherMap** | Weather → mood correlation | Yes |

### Agent System Enhancements
Currently in `scripts/ai/`:
- `aether_agent.py` — main agent
- `agent_router.py` — query routing
- `context_builder.py` — context building
- `intent_classifier.py` — intent classification
- `response_generator.py` — response generation

**Planned upgrades**:
1. **Multi-agent system** — Separate agents for: productivity, health, finance, career
2. **Tool-use agent** — Agent that can call AETHER APIs and external services
3. **Memory-augmented agent** — Vector memory for semantic context retrieval
4. **Proactive agent** — Autonomous nudges based on behavior patterns

### Automation Pipelines
| Automation | Trigger | Action |
|---|---|---|
| **Smart Nudge** | Low energy detected for >2h | Send motivational Telegram message |
| **Flow Protector** | Flow state detected | Auto-DND, block distractions |
| **Daily Journal** | 9:00 PM IST | Auto-create Notion page with day summary |
| **Streak Alert** | Midnight if no activity | Send reminder to log something |
| **Weekly Report** | Sunday 9:00 PM | Comprehensive week analysis |
| **Burnout Warning** | 7-day stress rolling avg > 0.6 | Send warning + rest suggestions |
| **Achievement System** | Goals/milestones hit | Gamification rewards |

### Real Data Integration Strategy
1. **Phase 1**: Log 200+ diverse events via Telegram (mix energy levels, topics, times)
2. **Phase 2**: Connect WakaTime + Google Calendar for automatic activity data
3. **Phase 3**: Add health device data (sleep tracker, fitness band)
4. **Phase 4**: Financial data via expense tracking app API
5. **Phase 5**: Social data (optional) — conversation patterns, social energy

---

## Roadmap

### ✅ Completed (Season 1)
- [x] Cloudflare Worker with 18+ routes
- [x] Telegram Bot with 20+ commands
- [x] NLP parser (Llama 3 8B) — 22 features extracted
- [x] Voice note transcription (Whisper)
- [x] Image analysis (LLaVA 1.5 7B)
- [x] ML pipeline (RF classifier + GBM regressor)
- [x] MLflow → DagsHub experiment tracking
- [x] GitHub Actions CI/CD (5 workflows)
- [x] PWA dashboard (installable on Android/iOS)
- [x] Service Worker (offline + sync + push)
- [x] Auto GitHub commit logging
- [x] Code graph (GitNexus)
- [x] 3x daily cron briefings
- [x] Health/finance/career commands
- [x] AI chat (JARVIS) with engine switching
- [x] Gamification (XP, levels, streaks, achievements)

### 🔄 In Progress (Current Sprint)
- [ ] Log 30+ diverse events for real ML predictions
- [ ] Add GITHUB_TOKEN to Cloudflare Worker env
- [ ] Fix PWA service worker path ✅ Done
- [ ] Create comprehensive documentation ✅ Done

### 📅 This Month (Season 2)
- [ ] AES-256 encryption for raw diary text
- [ ] Password gate for sensitive dashboard views
- [ ] Dev branch + `learning-bot-dev` worker
- [ ] CF Vectorize semantic memory
- [ ] Advanced flow predictor (predict peak 45 mins ahead)
- [ ] MCP server (Model Context Protocol)

### 📅 Month 2
- [ ] CF D1 SQL for complex analytics
- [ ] Native Android APK (Capacitor.js wraps PWA)
- [ ] Google Calendar integration
- [ ] Burnout predictor model
- [ ] Multi-agent system
- [ ] Notion auto-journal

### 📅 Month 3+ (Production Grade)
- [ ] Multi-model ensemble
- [ ] JWT auth on all endpoints
- [ ] Rate limiting (CF WAF)
- [ ] Audit logging
- [ ] Data export & portability
- [ ] Tool-use agent with external API access

---

## Troubleshooting

### Common Issues

**Q: PWA won't install on Android**
- Ensure you're on HTTPS (Cloudflare Pages handles this)
- Open in Chrome, visit `chrome://flags/#bypass-app-banner-engagement-checks` → Enable
- Check DevTools → Application → Manifest and Service Worker tabs

**Q: ML pipeline fails**
- Check GitHub Actions logs for the specific step
- Ensure `data/raw/events.csv` has at least 5 events
- Verify `DAGSHUB_TOKEN` is set in GitHub Secrets

**Q: Service Worker not registering**
- Ensure `sw.js` exists at `/site/sw.js` (not just in `/site/data/`)
- Check browser DevTools → Application → Service Workers
- Try unregistering and reloading

**Q: Telegram bot not responding**
- Verify `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` are set in Cloudflare Worker env
- Check webhook URL: `POST /webhook` should be registered with Telegram

**Q: Dashboard shows old data**
- ML pipeline runs nightly — trigger manually via GitHub Actions
- Check if `site/data/dashboard.json` was updated
- Clear browser cache / service worker cache

**Q: Models showing 100% accuracy**
- This is normal with small datasets (<100 events)
- Log more diverse events to get realistic accuracy metrics
- Cross-validation score (98.9%) is a better indicator

---

## Git Branches

| Branch | Purpose | Status |
|---|---|---|
| `master` | Production | ✅ Active |
| `remotes/origin/cloudflare/workers-autoconfig` | CF auto-config | Legacy |
| `remotes/origin/update_worker_name_to_learning-bot` | Worker rename | Legacy |

---

> **Last updated**: April 1, 2026
> **Total scripts**: 37 Python + 2 JavaScript
> **Total lines of code**: ~10,000+ (worker.js alone: 1,900+)
> **Cost**: $0/month · **Uptime**: 99.9%+ (Cloudflare edge)
