# DEBT-01: Worker Monolith Split Plan

## Current State
`api/worker.js` — **2,600+ lines** in a single file containing:
- Route handler (fetch + scheduled)
- Telegram webhook processing
- NLP pipeline (AI + fallback)
- Chat engines (ML, Worker, Hybrid)
- Dashboard/events CRUD
- Job board logic
- Automation engine (cron nudges)
- Encryption helpers
- KV storage utilities
- Error tracking + backup

## Target Module Structure
```
api/
├── worker.js          ← Entry point: just routes + fetch/scheduled
├── modules/
│   ├── routes.js      ← URL routing map
│   ├── telegram.js    ← handleWebhook, sendTelegram, buildTelegramReply
│   ├── nlp.js         ← nlpParse, fallbackNLP, keyword lists
│   ├── chat.js        ← handleChat, engine switcher, system prompts
│   ├── dashboard.js   ← handleDashboard, handleUpdateDashboard, floatingBrain
│   ├── events.js      ← saveEvent, getRecentEvents, handleEvents
│   ├── jobs.js        ← all /jobs/* handlers
│   ├── automation.js  ← scheduled triggers, morning/evening briefings
│   ├── encryption.js  ← encryptText, decryptText
│   ├── state.js       ← analyzeState, analyzePatterns, getLatestState
│   ├── auth.js        ← checkAdminAuth
│   └── errors.js      ← logError, backupEvents
└── utils/
    ├── kv.js          ← KV read/write helpers
    ├── cors.js        ← CORS_HEADERS, jsonResp, textResp
    └── constants.js   ← MAX_EVENTS, MAX_HISTORY
```

## Migration Steps
1. Switch wrangler.toml to `main = "api/worker.js"` (already ESM with `export default`)
2. Extract pure functions first (no env dependency): `analyzeState`, `fallbackNLP`, `analyzePatterns`
3. Extract utility functions: `jsonResp`, `textResp`, `CORS_HEADERS`
4. Extract handlers one at a time, testing after each move
5. Keep worker.js as the thin entry point

## Risk Mitigation
- Extract one module per PR
- Run test suite after each extraction
- Keep the monolith working until all modules are verified
