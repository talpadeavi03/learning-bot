# AETHER AI OS — Project Map (Updated March 2026)

## Frontend
Cloudflare Pages
URL: https://learning-bot.pages.dev
Folder: site/

## API Worker (main — handles everything)
Name: learning-bot
URL: https://learning-bot.talpadeavi0303.workers.dev
File: api/worker.js
Routes: /webhook /chat /log-state /dashboard /events /health /trigger /log-github /reset-data /update-dashboard

## Telegram Bot
Webhook: POST https://learning-bot.talpadeavi0303.workers.dev/webhook
Commands: /help /stats /flow /goal /mood /week /streak /morning /evening /automate
Crons: 8:30am · 12:30pm · 8:30pm IST + 1am ML trigger

## GitHub Repo
https://github.com/talpadeavi03/learning-bot

## ML Pipeline
GitHub Actions — .github/workflows/ml_pipeline.yml
Schedule: nightly 1am IST
Steps: pull_events → data_cleaner → train_models → predict → push_dashboard

## Storage
Cloudflare KV: AETHER_KV (id: 4154fa683ced47c9871d0b43dfbd7a54)
Keys: events:list · state:YYYY-MM-DD · dashboard:latest · goal:YYYY-MM-DD

## Dashboard Data Flow
Worker /dashboard → computes live from KV events
ML pipeline → site/data/dashboard.json → POST /update-dashboard → KV

## Secrets

### Cloudflare Worker Environment Variables
TELEGRAM_BOT_TOKEN     — receive/send Telegram messages
TELEGRAM_CHAT_ID       — security: reject other senders
GITHUB_TOKEN           — auto-trigger ML pipeline every 5 events
NOTION_TOKEN           — optional: Notion journal integration
SPOTIFY_FLOW_PLAYLIST  — optional: auto-play focus playlist

### GitHub Actions Secrets
CLOUDFLARE_API_TOKEN   — wrangler deploy permissions

## Deprecated (not used)
- aether-api.talpadeavi0303.workers.dev (old worker name)
- bot-webhook.talpadeavi0303.workers.dev (bypassed — direct webhook)
- workers/webhook.js (not used — merged into api/worker.js)