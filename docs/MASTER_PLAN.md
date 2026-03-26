                    ┌────────────────────┐
                    │      INPUTS        │
                    │────────────────────│
                    │ Telegram messages  │
                    │ GitHub pushes      │
                    │ Goals / check-ins  │
                    │ Images / voice     │
                    └─────────┬──────────┘
                              │
                              ▼
                 ┌─────────────────────────┐
                 │  INGESTION LAYER        │
                 │  (Cloudflare Worker)    │
                 │─────────────────────────│
                 │ /webhook                │
                 │ NLP parser              │
                 │ Feature extraction      │
                 │ saveEvent()             │
                 └─────────┬───────────────┘
                           │
                           ▼
                ┌──────────────────────────┐
                │  EVENT STORAGE           │
                │──────────────────────────│
                │ Cloudflare KV            │
                │ events:list              │
                │ events:count             │
                │ state:YYYY-MM-DD         │
                └─────────┬────────────────┘
                          │
                          ▼
             ┌─────────────────────────────┐
             │  TRIGGER ENGINE             │
             │─────────────────────────────│
             │ every 3 events              │
             │ triggerMLPipeline()         │
             └─────────┬───────────────────┘
                       │
                       ▼
        ┌────────────────────────────────────┐
        │        ML PIPELINE                 │
        │        (GitHub Actions)            │
        │────────────────────────────────────│
        │ pull_events.py                     │
        │ data_cleaner.py                    │
        │ train_models.py                    │
        │ predict.py                         │
        │ insight_engine.py                  │
        │ pattern_engine.py                  │
        │ habit_tracker.py                   │
        │ memory_graph_builder.py            │
        │ push_dashboard.py                  │
        └─────────────┬──────────────────────┘
                      │
                      ▼
           ┌─────────────────────────────┐
           │        AI BRAIN             │
           │─────────────────────────────│
           │ Behavior model (RF + GBM)   │
           │ Flow state prediction       │
           │ Productivity signals        │
           │ Habit analysis              │
           │ Pattern detection           │
           └────────────┬────────────────┘
                        │
                        ▼
         ┌────────────────────────────────┐
         │         OUTPUT LAYER           │
         │────────────────────────────────│
         │ dashboard.json                 │
         │ insights.json                  │
         │ Worker /dashboard API          │
         │ Telegram responses             │
         └──────────────┬─────────────────┘
                        │
                        ▼
             ┌────────────────────────┐
             │        USER            │
             │────────────────────────│
             │ Telegram               │
             │ Web dashboard          │
             │ Future Android app     │
             └────────────────────────┘

# AETHER OS — Master Plan v3.0
> Personal AI Operating System · Zero Cost · Production Ready

---

## CURRENT REALITY (what we actually have)

### URLs
| Service | URL | Status |
|---|---|---|
| Frontend Dashboard | https://learning-bot.pages.dev | ✅ LIVE |
| API Worker | https://learning-bot.talpadeavi0303.workers.dev | ✅ LIVE |
| Old API Worker | https://aether-api.talpadeavi0303.workers.dev | ⚠ OLD — redirect |
| Old Webhook | https://bot-webhook.talpadeavi0303.workers.dev | ⚠ OLD — bypass |
| GitHub Repo | https://github.com/talpadeavi03/learning-bot | ✅ LIVE |

> NOTE: PROJECT_MAP.md is outdated. The real worker is learning-bot, not aether-api.
> The bot-webhook worker is bypassed — Telegram posts directly to learning-bot/webhook.

### Secrets (where each one lives)
| Secret | Location | Used by |
|---|---|---|
| CLOUDFLARE_API_TOKEN | GitHub Secrets | deploy.yml — wrangler deploy |
| TELEGRAM_BOT_TOKEN | Cloudflare Worker env | worker.js — send/receive messages |
| TELEGRAM_CHAT_ID | Cloudflare Worker env | worker.js — security filter |
| ANTHROPIC_API_KEY | GitHub Secrets | Not used yet (CF AI is free) |
| GITHUB_TOKEN | Cloudflare Worker env | worker.js — auto ML trigger |

### Repo Structure (actual, from tree.txt)
```
learning-bot/
├── api/worker.js              ← THE BRAIN — all routes, NLP, cron
├── wrangler.toml              ← CF config — KV + AI + crons
├── site/
│   ├── index.html             ← Dashboard PWA
│   ├── manifest.json          ← PWA installable
│   ├── data/dashboard.json    ← ML predictions output
│   └── icons/                 ← PWA icons
├── scripts/
│   ├── pipeline/              ← pull, clean, push, reset
│   ├── ml/                    ← train_models, predict, ai_summary
│   ├── features/              ← daily_aggregator, feature_extractor
│   ├── analytics/             ← weekly_summary, heatmap, insights
│   └── ingestion/             ← nlp_parser, tracker
├── data/
│   ├── raw/events.csv         ← all events from KV
│   ├── features/              ← parquet feature files
│   └── processed/             ← cleaned data
├── models/
│   └── productivity_model.pkl ← trained flow classifier
├── .github/workflows/
│   ├── deploy.yml             ← auto-deploy on push
│   ├── ml_pipeline.yml        ← nightly ML
│   ├── github_activity.yml    ← auto-log commits
│   └── ingest.yml             ← Telegram batch ingestion
├── docs/
│   ├── aether-architecture.html
│   ├── aether-progress.html
│   └── aether-vision.html
├── requirements-ml.txt
├── requirements-analytics.txt
└── requirements-ingest.txt
```

---

## FULL ZERO-COST STACK

### Infrastructure (all free forever)
| Layer | Service | Free Tier | What we use |
|---|---|---|---|
| **Worker/API** | Cloudflare Workers | 100k req/day | All routes, NLP, cron, automations |
| **Storage** | Cloudflare KV | 100k reads, 1k writes/day | Events, state, dashboard, goals |
| **AI — NLP** | CF Llama 3 8B | Workers AI free | Parse every message, 22 features |
| **AI — Voice** | CF Whisper | Workers AI free | Voice notes → text |
| **AI — Vision** | CF LLaVA 1.5 7B | Workers AI free | Photo/whiteboard extraction |
| **Frontend** | Cloudflare Pages | Unlimited | PWA dashboard |
| **CI/CD + ML** | GitHub Actions | 2000 min/month | Deploy + nightly ML pipeline |
| **Bot** | Telegram Bot API | Unlimited | All bot commands + briefings |
| **Vector memory** | CF Vectorize | 5M vectors free | Semantic search (next) |
| **SQL analytics** | CF D1 | 5GB free | Complex queries (next) |
| **ML tracking** | MLflow on Colab | Free | Experiment tracking |
| **Notebooks** | Google Colab | Free GPU | Model training at scale |

### MLflow + Colab Integration (next feature)
```
Google Colab (free GPU)
  └── train_models.py runs here
  └── mlflow.log_metrics() → MLflow tracking server
  └── model saved → pushed to GitHub via API
  └── GitHub Actions picks up → deploys to CF

MLflow Server → free on DagsHub.com (free tier)
  URL: https://dagshub.com/talpadeavi03/learning-bot.mlflow
  Tracks: accuracy, flow_distribution, feature_importance
```

---

## ENCRYPTION PLAN (personal diary data)

### What needs encrypting
- Raw diary text (your personal thoughts, feelings, health)
- Energy/stress/mood scores linked to your name
- Location data, relationship mentions, financial data

### Zero-cost encryption approach
```
YOUR MESSAGE (Telegram)
  ↓
Worker receives raw text
  ↓
NLP extracts features (energy:0.8, topic:coding) → stored PLAIN (needed for ML)
  ↓
raw_text encrypted with AES-256 before KV storage
  ↓
KV stores: { features: PLAIN, raw_text: ENCRYPTED }
  ↓
ML trains on plain features only (never sees raw text)
  ↓
Dashboard shows features + insights (no raw text shown)
  ↓
To read raw diary: enter password → decrypt in browser
```

### Implementation
- **Key**: derived from your password using PBKDF2 (never stored)
- **Encryption**: AES-256-GCM in the Worker (Web Crypto API — built into CF)
- **Storage**: encrypted blob in KV, decryption only in browser
- **ML never sees raw text** — only the extracted numbers
- **Even if KV is compromised**: raw text is unreadable without password

### Dashboard password gate
- DOCS tab and RAW DATA view require password
- Password checked locally (no server call) using derived key attempt
- Wrong password = garbled text (natural failure mode)

---

## DEVSECOPS PLAN (dev/prod separation)

### Two environments
```
PROD (master branch)                    DEV (dev branch)
─────────────────────────────────────   ─────────────────────────────────
Worker: learning-bot                    Worker: learning-bot-dev
URL: learning-bot.talpadeavi0303.workers.dev   URL: learning-bot-dev.talpadeavi0303.workers.dev
KV: AETHER_KV (prod)                    KV: AETHER_KV_DEV
Bot: @your_main_bot                     Bot: @aether_dev_bot (create new)
Pages: learning-bot.pages.dev           Pages: dev.learning-bot.pages.dev
Deploy: git push master → auto          Deploy: git push dev → auto staging
```

### wrangler.toml environments
```toml
# PROD (default)
name = "learning-bot"
[env.dev]
name = "learning-bot-dev"
[[env.dev.kv_namespaces]]
binding = "AETHER_KV"
id = "YOUR_DEV_KV_ID"
[env.dev.triggers]
crons = []  # no auto-briefings in dev
```

### GitHub Actions secrets (separate per env)
```
CLOUDFLARE_API_TOKEN          → both envs (same token, different workers)
TELEGRAM_BOT_TOKEN_PROD       → prod bot
TELEGRAM_BOT_TOKEN_DEV        → dev bot
```

---

## ML PIPELINE — FULL PRODUCTION PLAN

### Current pipeline (working)
```
GitHub Actions (nightly 1am IST)
  pull_events.py → data/raw/events.csv
  data_cleaner.py → data/processed/events_clean.csv
  train_models.py → models/productivity_model.pkl
  predict.py → site/data/dashboard.json
  push_dashboard.py → POST /update-dashboard → CF KV
```

### Enhanced pipeline (next 2 weeks)
```
GitHub Actions triggers Colab notebook via Colab API
  ↓
Colab (free GPU T4):
  feature_extractor.py → behavior_features.parquet
  daily_aggregator.py → daily_behavior.parquet
  train_models.py (enhanced) → multiple models
  mlflow.log_everything() → DagsHub MLflow server
  ↓
Models pushed back to repo via GitHub API
  ↓
predict.py runs → richer dashboard predictions
  ↓
push_dashboard.py → KV → live dashboard
```

### Models to train (all free)
| Model | Predicts | Features | Status |
|---|---|---|---|
| Flow classifier | FLOW/PRE_FLOW/NOMINAL/ANXIETY/RECOVERY | 33 behavioral | ✅ BUILT |
| Energy regressor | Energy 0-1 for next 2 hours | Time series | NEXT |
| Burnout detector | Risk score 0-100 | 7-day rolling | MONTH 2 |
| Topic recommender | What to study next | Topic momentum | MONTH 2 |
| Sleep quality predictor | Sleep score from day patterns | Activity timing | MONTH 3 |

---

## WHAT TO BUILD — ORDERED BY IMPACT

### This week
1. **Encrypt raw_text in KV** — AES-256-GCM in Worker
2. **Password gate in dashboard** — browser-side decryption
3. **Dev environment** — dev branch + learning-bot-dev worker
4. **Health commands** — /exercise /sleep /food /spend /weight /job
5. **Update PROJECT_MAP.md** — fix outdated URLs

### Next 2 weeks
6. **CF Vectorize** — semantic memory, search past events
7. **MLflow on DagsHub** — track model experiments
8. **Colab integration** — free GPU training
9. **Weekly auto-report** — Sunday 9pm Telegram summary
10. **Flow predictor V2** — predict peak 45 mins ahead

### Month 2
11. **CF D1 SQL** — complex analytics queries
12. **Native APK** — Capacitor.js wraps PWA
13. **Google Calendar** — auto-block deep work windows
14. **Burnout predictor** — early warning system
15. **Notion auto-journal** — nightly structured entry

### Month 3+ (production level)
16. **Multi-model ensemble** — combine all predictors
17. **API authentication** — JWT tokens for all endpoints
18. **Rate limiting** — CF WAF rules
19. **Audit log** — every action logged
20. **Data export** — full data portability

---

## PRODUCTION READINESS CHECKLIST

### Security
- [ ] Encrypt raw_text (AES-256-GCM)
- [ ] Password gate for sensitive views
- [ ] JWT auth on /trigger and /reset-data
- [ ] Rate limiting (CF WAF)
- [ ] Rotate tokens every 90 days
- [ ] Separate prod/dev secrets

### Reliability
- [ ] Health check alerts (if worker down → Telegram alert)
- [ ] KV backup (export events weekly to GitHub)
- [ ] Error tracking (log to separate KV key)
- [ ] Retry logic on Telegram send failures

### Scalability
- [ ] Migrate from KV to D1 for complex queries
- [ ] CF Queues for async event processing
- [ ] Edge caching for dashboard endpoint

---

## UPDATED URLs (source of truth)

```
Frontend:    https://learning-bot.pages.dev
Worker API:  https://learning-bot.talpadeavi0303.workers.dev
Webhook:     POST /webhook (same worker, not separate)
Health:      https://learning-bot.talpadeavi0303.workers.dev/health
Events:      https://learning-bot.talpadeavi0303.workers.dev/events
Dashboard:   https://learning-bot.talpadeavi0303.workers.dev/dashboard
GitHub:      https://github.com/talpadeavi03/learning-bot
MLflow:      https://dagshub.com/talpadeavi03/learning-bot.mlflow (next)
```