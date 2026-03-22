// ═════════════════════════════════════════════════════════════════
// BOT COMMANDS
// /stats  — weekly summary
// /flow   — current flow state
// /goal   — set today's goal
// /mood   — quick mood log
// /help   — list commands
// ═════════════════════════════════════════════════════════════════

async function handleCommand(text, chatId, env) {
  const parts   = text.trim().split(' ');
  const command = parts[0].toLowerCase();
  const args    = parts.slice(1).join(' ');

  switch (command) {
    case '/help':
    case '/start': {
      await sendTelegram(chatId, 
        `🤖 *AETHER OS — Commands*

` +
        `/stats — weekly performance summary
` +
        `/flow  — are you in flow right now?
` +
        `/goal  — set today's main goal
` +
        `/mood  — quick mood check-in
` +
        `/week  — 7-day activity overview

` +
        `Or just send any message, voice note, or photo and AETHER will log it.`, env);
      return true;
    }

    case '/stats': {
      const events = await getRecentEvents(50, env);
      if (events.length === 0) {
        await sendTelegram(chatId, '📊 No data yet. Send some messages first!', env);
        return true;
      }
      const avgEnergy = events.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / events.length;
      const avgStress = events.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / events.length;
      const studySessions = events.filter(e => e.is_study_session).length;
      const topics = [...new Set(events.map(e => e.topic).filter(Boolean))].slice(0, 5);
      const checkins = events.filter(e => e.input_type === 'checkin').length;
      await sendTelegram(chatId,
        `📊 *AETHER Weekly Stats*

` +
        `Events logged: ${events.length}
` +
        `Study sessions: ${studySessions}
` +
        `Check-ins: ${checkins}

` +
        `⚡ Avg energy: ${Math.round(avgEnergy * 100)}%
` +
        `😤 Avg stress: ${Math.round(avgStress * 100)}%

` +
        `🧠 Topics: ${topics.join(', ') || 'none yet'}

` +
        `Keep logging — model trains after 30 days!`, env);
      return true;
    }

    case '/flow': {
      const state = await getLatestState(env);
      const events = await getRecentEvents(5, env);
      const recentEnergy = events.length > 0
        ? events.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / events.length
        : 0.5;
      const recentStress = events.length > 0
        ? events.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / events.length
        : 0.2;

      let flowStatus, advice;
      if (state) {
        flowStatus = state.flow_class || 'UNKNOWN';
        if (flowStatus === 'FLOW') advice = 'You are in flow. Protect this time — no distractions.';
        else if (flowStatus === 'PRE_FLOW') advice = 'Almost there. One focused task to enter flow.';
        else if (flowStatus === 'ANXIETY') advice = 'Challenge too high. Break the task into smaller pieces.';
        else if (flowStatus === 'RECOVERY') advice = 'Rest mode. Light tasks only.';
        else advice = 'Log your state with the check-in to get a flow reading.';
      } else if (recentEnergy > 0.7 && recentStress < 0.3) {
        flowStatus = 'FLOW';
        advice = 'Recent messages suggest flow. Stay focused!';
      } else {
        flowStatus = 'NOMINAL';
        advice = 'Open the AETHER dashboard and log your state for a precise reading.';
      }

      await sendTelegram(chatId,
        `🎯 *Flow State*

` +
        `Status: *${flowStatus}*
` +
        `Energy: ${Math.round(recentEnergy * 100)}%
` +
        `Stress: ${Math.round(recentStress * 100)}%

` +
        `${advice}`, env);
      return true;
    }

    case '/goal': {
      if (!args) {
        await sendTelegram(chatId, '🎯 What is your main goal today? Usage: /goal [your goal]', env);
        return true;
      }
      const today = new Date().toISOString().split('T')[0];
      await env.AETHER_KV.put(`goal:${today}`, args);
      await saveEvent({
        timestamp:       new Date().toISOString(),
        input_type:      'goal',
        raw_text:        args,
        topic:           'goal setting',
        sentiment:       'positive',
        energy_signal:   0.7,
        stress_signal:   0.1,
        is_goal_mention: true,
        summary:         args,
      }, env);
      await sendTelegram(chatId, `✅ Goal set: *${args}*

AETHER will track this today.`, env);
      return true;
    }

    case '/mood': {
      const moodMap = {
        '1': { label: 'Very low',  energy: 0.1, stress: 0.6 },
        '2': { label: 'Low',       energy: 0.3, stress: 0.4 },
        '3': { label: 'Neutral',   energy: 0.5, stress: 0.3 },
        '4': { label: 'Good',      energy: 0.7, stress: 0.2 },
        '5': { label: 'Excellent', energy: 0.9, stress: 0.1 },
      };
      if (!args || !moodMap[args]) {
        await sendTelegram(chatId, '😊 Rate your mood: /mood 1-5 (1=very low, 3=neutral, 5=excellent)', env);
        return true;
      }
      const mood = moodMap[args];
      await saveEvent({
        timestamp:     new Date().toISOString(),
        input_type:    'mood',
        raw_text:      `mood: ${mood.label}`,
        topic:         'mood check-in',
        energy_signal: mood.energy,
        stress_signal: mood.stress,
        sentiment:     args >= '4' ? 'positive' : args === '3' ? 'neutral' : 'negative',
        summary:       `Mood rated ${args}/5: ${mood.label}`,
      }, env);
      await sendTelegram(chatId, `${args >= '4' ? '😊' : args === '3' ? '😐' : '😔'} Mood logged: *${mood.label}* (${args}/5)

Energy: ${Math.round(mood.energy*100)}%`, env);
      return true;
    }

    case '/week': {
      const events = await getRecentEvents(100, env);
      const days = {};
      events.forEach(e => {
        const day = e.timestamp?.split('T')[0];
        if (day) {
          if (!days[day]) days[day] = { count: 0, energy: [] };
          days[day].count++;
          days[day].energy.push(e.energy_signal || 0.5);
        }
      });
      const dayLines = Object.entries(days).slice(0, 7).map(([day, d]) => {
        const avg = d.energy.reduce((s,v) => s+v, 0) / d.energy.length;
        const bar = '█'.repeat(Math.round(avg * 5)) + '░'.repeat(5 - Math.round(avg * 5));
        return `${day}: ${bar} ${d.count} events`;
      }).join('\n');
      await sendTelegram(chatId,
        `📅 *7-Day Activity*

\`\`\`
${dayLines || 'No data yet'}
\`\`\`

Keep logging daily!`, env);
      return true;
    }

    case '/briefing':
    case '/morning': {
      await sendMorningBriefing(env);
      return true;
    }

    case '/summary':
    case '/evening': {
      await sendEveningSummary(env);
      return true;
    }

    case '/automate': {
      if (!args) {
        await sendTelegram(chatId,
          `⚡ *AETHER Automations*\n\n` +
          `/automate notion    — log today to Notion\n` +
          `/automate spotify   — open flow playlist\n` +
          `/automate nudge     — send me a smart nudge\n` +
          `/automate checkin   — send check-in reminder\n` +
          `/automate webhook [url] — call custom URL`, env);
        return true;
      }
      const subAction = args.split(' ')[0];
      const actionMap = {
        'notion':   'notion_log',
        'spotify':  'spotify_flow',
        'nudge':    'smart_nudge',
        'checkin':  'checkin_reminder',
      };
      if (subAction === 'webhook') {
        const webhookUrl = args.split(' ')[1];
        if (!webhookUrl) {
          await sendTelegram(chatId, '⚠️ Usage: /automate webhook https://yoururl.com', env);
          return true;
        }
        const r = await handleTrigger(
          new Request('https://x/trigger', {
            method: 'POST',
            body: JSON.stringify({ action: 'webhook', data: { url: webhookUrl } }),
          }), env
        );
        await sendTelegram(chatId, '✅ Webhook triggered!', env);
        return true;
      }
      const mappedAction = actionMap[subAction];
      if (!mappedAction) {
        await sendTelegram(chatId, `⚠️ Unknown automation: ${subAction}. Try /automate for list.`, env);
        return true;
      }
      await handleTrigger(
        new Request('https://x/trigger', {
          method: 'POST',
          body: JSON.stringify({ action: mappedAction }),
        }), env
      );
      return true;
    }

    case '/streak': {
      const events = await getRecentEvents(100, env);
      const streak = await calculateStreak(events);
      const total  = events.length;
      await sendTelegram(chatId,
        `🔥 *Streak: ${streak} day${streak !== 1 ? 's' : ''}*

` +
        `Total events logged: ${total}
` +
        `Keep logging daily to maintain your streak!`, env);
      return true;
    }

    default:
      return false; // not a recognized command, treat as regular text
  }
}

/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║            AETHER OS — Cloudflare Worker v2.0               ║
 * ║            api/worker.js                                    ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  ROUTES                                                      ║
 * ║  POST /webhook        ← Telegram messages (all types)       ║
 * ║  POST /chat           ← Dashboard AI chat                   ║
 * ║  POST /log-state      ← One-tap check-in widget             ║
 * ║  GET  /dashboard      ← Latest dashboard.json for UI        ║
 * ║  GET  /events         ← Raw events log (for ML pipeline)    ║
 * ║  GET  /health         ← Status check                        ║
 * ╠══════════════════════════════════════════════════════════════╣
 * ║  SECRETS — add all in GitHub → Repo Settings → Secrets      ║
 * ║  Also add in Cloudflare Worker → Settings → Variables       ║
 * ║                                                              ║
 * ║  TELEGRAM_BOT_TOKEN   from @BotFather on Telegram           ║
 * ║  TELEGRAM_CHAT_ID     your personal numeric chat ID         ║
 * ║  OPENAI_API_KEY       from platform.openai.com            ║
 * ║                       used for chat, NLP, vision & voice   ║
 * ║                                                              ║
 * ║  KV NAMESPACE — create in Cloudflare dashboard              ║
 * ║  Add binding named AETHER_KV in wrangler.toml:              ║
 * ║  [[kv_namespaces]]                                          ║
 * ║  binding = "AETHER_KV"                                      ║
 * ║  id = "YOUR_KV_NAMESPACE_ID"                                ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

// All AI now runs on Cloudflare Workers AI (free)
// CF models used: llama-3-8b-instruct (chat+NLP), llava-1.5-7b (vision), whisper (voice)
const MAX_EVENTS       = 500;   // max rows kept in KV events log
const MAX_HISTORY      = 20;    // max chat turns kept per session

// ─────────────────────────────────────────────────────────────────
// HELPERS — Response builders
// ─────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
  });
}

function textResp(text, status = 200) {
  return new Response(text, {
    status,
    headers: { 'Content-Type': 'text/plain', ...CORS_HEADERS },
  });
}

// ─────────────────────────────────────────────────────────────────
// MAIN ENTRY
// ─────────────────────────────────────────────────────────────────

export default {

  // ── Cron jobs — runs on schedule set in wrangler.toml ──────────
  async scheduled(event, env, ctx) {
    const hour = new Date().getUTCHours();
    // Adjust for IST (UTC+5:30) — 8am IST = 2:30 UTC, 9pm IST = 15:30 UTC
    // We use UTC 3 for morning (8:30am IST) and UTC 15 for evening (8:30pm IST)
    if (hour === 3)  ctx.waitUntil(sendMorningBriefing(env));
    if (hour === 15) ctx.waitUntil(sendEveningSummary(env));
    // Midday nudge at 12:30pm IST (7:00 UTC) if no data logged yet today
    if (hour === 7)  ctx.waitUntil(middayNudge(env));
  },

  async fetch(request, env) {

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);

    try {
      // ── Route table ──────────────────────────────────────────
      if (url.pathname === '/webhook'   && request.method === 'POST') return handleWebhook(request, env);
      if (url.pathname === '/chat'      && request.method === 'POST') return handleChat(request, env);
      if (url.pathname === '/log-state' && request.method === 'POST') return handleLogState(request, env);
      if (url.pathname === '/dashboard' && request.method === 'GET')  return handleDashboard(request, env);
      if (url.pathname === '/events'    && request.method === 'GET')  return handleEvents(request, env);
      if (url.pathname === '/update-dashboard' && request.method === 'POST') return handleUpdateDashboard(request, env);
      if (url.pathname === '/log-github'       && request.method === 'POST') return handleGitHubLog(request, env);
      if (url.pathname === '/trigger'          && request.method === 'POST') return handleTrigger(request, env);
      if (url.pathname === '/health'    && request.method === 'GET')  return handleHealth(request, env);

      // ── Legacy: keep old /api route working ──────────────────
      if (url.pathname.startsWith('/api')) {
        return jsonResp({ status: 'AETHER API ONLINE', version: '2.0' });
      }

      // ── Serve static frontend (Cloudflare Pages assets) ──────
      return env.ASSETS.fetch(request);

    } catch (err) {
      console.error('[AETHER] Unhandled error:', err);
      return jsonResp({ error: 'Internal server error', detail: err.message }, 500);
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 1. TELEGRAM WEBHOOK
//    Receives all message types from Telegram bot
//    Text → direct NLP
//    Voice / Video note → Whisper → NLP
//    Photo → GPT-4o Vision → NLP
//    All paths converge into processText() → saveEvent()
// ═════════════════════════════════════════════════════════════════

async function handleWebhook(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return textResp('Bad JSON', 400);
  }

  const msg = body?.message || body?.edited_message;
  if (!msg) return textResp('No message', 200); // Telegram needs 200 or it retries

  const chatId    = msg.chat?.id?.toString();
  const timestamp = new Date(msg.date * 1000).toISOString();

  // Security: only accept from your own chat ID
  if (env.TELEGRAM_CHAT_ID && chatId !== env.TELEGRAM_CHAT_ID.toString()) {
    console.warn('[AETHER] Rejected message from unknown chat:', chatId);
    return textResp('Unauthorized', 200); // still 200 so Telegram stops retrying
  }

  let rawText   = '';
  let inputType = 'text';
  let extra     = {};

  // ── TEXT ─────────────────────────────────────────────────────
  if (msg.text) {
    // Handle bot commands first
    if (msg.text.startsWith('/')) {
      const handled = await handleCommand(msg.text, chatId, env);
      if (handled) return textResp('OK', 200);
    }
    rawText   = msg.text;
    inputType = 'text';
  }

  // ── VOICE NOTE (hold mic button) ─────────────────────────────
  else if (msg.voice) {
    if (!env.AI) {
      await sendTelegram(chatId, '🎙 Voice noted! AI binding not configured yet.\nAdd [ai] to wrangler.toml', env);
      return textResp('No AI binding', 200);
    }
    await sendTelegram(chatId, '🎙 Transcribing...', env);
    try {
      const fileUrl = await getTelegramFileUrl(msg.voice.file_id, env);
      rawText       = await whisperTranscribe(fileUrl, env);
      inputType     = 'voice';
      extra.duration_seconds = msg.voice.duration;
    } catch (e) {
      await sendTelegram(chatId, '⚠️ Could not transcribe: ' + e.message, env);
      return textResp('Voice error', 200);
    }
  }

  // ── VIDEO NOTE (circle video) ─────────────────────────────────
  else if (msg.video_note) {
    if (!env.AI) {
      await sendTelegram(chatId, '🎥 Video noted! AI binding not configured yet.\nAdd [ai] to wrangler.toml', env);
      return textResp('No AI binding', 200);
    }
    await sendTelegram(chatId, '🎥 Processing video...', env);
    try {
      const fileUrl = await getTelegramFileUrl(msg.video_note.file_id, env);
      rawText       = await whisperTranscribe(fileUrl, env);
      inputType     = 'video_note';
      extra.duration_seconds = msg.video_note.duration;
    } catch (e) {
      await sendTelegram(chatId, '⚠️ Could not process video: ' + e.message, env);
      return textResp('Video error', 200);
    }
  }

  // ── PHOTO (whiteboard, book page, handwritten notes) ──────────
  else if (msg.photo) {
    await sendTelegram(chatId, '🖼 Reading image...', env);
    try {
      // Telegram sends multiple sizes — take the largest (last)
      const bestPhoto = msg.photo[msg.photo.length - 1];
      const fileUrl   = await getTelegramFileUrl(bestPhoto.file_id, env);
      rawText         = await openaiVisionExtract(fileUrl, msg.caption || '', env);
      inputType       = 'image';
    } catch (e) {
      await sendTelegram(chatId, '⚠️ Could not read image: ' + e.message, env);
      return textResp('Image error', 200);
    }
  }

  // ── DOCUMENT (PDF, text file) ─────────────────────────────────
  else if (msg.document) {
    const mime = msg.document.mime_type || '';
    if (mime === 'text/plain') {
      try {
        const fileUrl = await getTelegramFileUrl(msg.document.file_id, env);
        const resp    = await fetch(fileUrl);
        rawText       = await resp.text();
        inputType     = 'document';
      } catch (e) {
        await sendTelegram(chatId, '⚠️ Could not read document: ' + e.message, env);
        return textResp('Doc error', 200);
      }
    } else {
      await sendTelegram(chatId, '📎 Only .txt documents are supported right now.', env);
      return textResp('Unsupported doc type', 200);
    }
  }

  // ── STICKER / OTHER — ignore silently ────────────────────────
  else {
    return textResp('Unsupported message type', 200);
  }

  // ── Skip empty ───────────────────────────────────────────────
  if (!rawText.trim()) {
    await sendTelegram(chatId, '🤔 Could not extract any text from that.', env);
    return textResp('Empty text', 200);
  }

  // ── NLP Parse ────────────────────────────────────────────────
  const parsed = await nlpParse(rawText, inputType, env);

  // ── Enrich + Save event to KV ────────────────────────────────
  const hour      = new Date(timestamp).getUTCHours();
  const dayOfWeek = new Date(timestamp).getUTCDay(); // 0=Sun, 6=Sat
  const wordCount = rawText.trim().split(/\s+/).length;

  // Message complexity — longer = deeper thinking
  const complexity = Math.min(1, wordCount / 50);

  // Question ratio — questions = exploration mode
  const questionCount = (rawText.match(/\?/g) || []).length;
  const questionRatio = Math.min(1, questionCount / Math.max(1, wordCount / 10));

  // Exclamation = high energy signal
  const exclamations = (rawText.match(/!/g) || []).length;

  const event = {
    timestamp,
    input_type:      inputType,
    raw_text:        rawText.slice(0, 500),
    // Computed behavioral features
    hour_utc:        hour,
    hour_sin:        Math.sin(2 * Math.PI * hour / 24),
    hour_cos:        Math.cos(2 * Math.PI * hour / 24),
    day_of_week:     dayOfWeek,
    is_weekend:      dayOfWeek === 0 || dayOfWeek === 6,
    word_count:      wordCount,
    complexity:      Math.round(complexity * 100) / 100,
    question_ratio:  Math.round(questionRatio * 100) / 100,
    exclamation_count: exclamations,
    message_length:  rawText.length,
    ...parsed,
    ...extra,
  };
  await saveEvent(event, env);

  // ── Reply to user ─────────────────────────────────────────────
  const reply = buildTelegramReply(parsed, inputType, rawText);
  await sendTelegram(chatId, reply, env);

  return textResp('OK', 200);
}

// ═════════════════════════════════════════════════════════════════
// 2. CHAT ENDPOINT
//    Called by the AETHER dashboard chat UI
//    Receives conversation history + current metrics
//    Returns AI response as { reply: "..." }
// ═════════════════════════════════════════════════════════════════

async function handleChat(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResp({ error: 'Bad JSON' }, 400);
  }

  const { history = [], metrics = {}, activity = [], goals = [] } = body;

  // Pull recent events to give AETHER context about the user
  const recentEvents  = await getRecentEvents(10, env);
  const latestState   = await getLatestState(env);

  // Build system prompt with full personal context
  const systemPrompt = buildSystemPrompt(metrics, activity, goals, recentEvents, latestState);

  // Trim history to avoid token overflow
  const trimmedHistory = history.slice(-MAX_HISTORY);

  let reply;
  try {
    reply = await callOpenAI(systemPrompt, trimmedHistory, env);
  } catch (e) {
    console.error('[AETHER] OpenAI error:', e);
    return jsonResp({ error: 'AI unavailable: ' + e.message }, 500);
  }

  return jsonResp({ reply });
}

// ═════════════════════════════════════════════════════════════════
// 3. LOG STATE ENDPOINT
//    Called by the one-tap check-in widget (aether-checkin.html)
//    Saves structured state vector to KV
// ═════════════════════════════════════════════════════════════════

async function handleLogState(request, env) {
  let stateVector;
  try {
    stateVector = await request.json();
  } catch {
    return jsonResp({ error: 'Bad JSON' }, 400);
  }

  // Validate minimum fields
  if (!stateVector.state_label || stateVector.energy === undefined) {
    return jsonResp({ error: 'Missing required fields: state_label, energy' }, 400);
  }

  // Add server timestamp
  stateVector.server_timestamp = new Date().toISOString();

  // Save as today's state
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  await env.AETHER_KV.put(`state:${today}`, JSON.stringify(stateVector));

  // Also append as an event
  const event = {
    timestamp:   stateVector.server_timestamp,
    input_type:  'checkin',
    state_label: stateVector.state_label,
    energy:      stateVector.energy,
    stress:      stateVector.stress,
    mood:        stateVector.mood,
    flow_prob:   stateVector.flow_prob,
    flow_class:  stateVector.flow_class,
    goal:        stateVector.goal,
    mods:        (stateVector.mods || []).join(','),
  };
  await saveEvent(event, env);

  // Update dashboard metrics with new state
  await refreshDashboardFromState(stateVector, env);

  console.log('[AETHER] State logged:', stateVector.state_label, '| energy:', stateVector.energy);
  return jsonResp({ ok: true, message: 'State synced to AETHER' });
}

// ═════════════════════════════════════════════════════════════════
// 4. DASHBOARD ENDPOINT
//    Serves the latest dashboard.json to the frontend UI
//    Falls back to sensible defaults if no data yet
// ═════════════════════════════════════════════════════════════════

async function handleDashboard(request, env) {
  try {
    // Always recompute from real events for freshness
    const events     = await getRecentEvents(200, env);
    const latestState = await getLatestState(env);
    const today      = new Date().toISOString().split('T')[0];
    const todayEv    = events.filter(e => e.timestamp?.startsWith(today));
    const todayGoal  = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);

    // Streak
    const streak = await calculateStreak(events);

    // Today metrics
    const avgEnergy = todayEv.length > 0
      ? Math.round(todayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / todayEv.length * 100)
      : latestState ? Math.round((latestState.energy || 0.5) * 100) : 0;

    const avgStress = todayEv.length > 0
      ? Math.round(todayEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / todayEv.length * 100)
      : latestState ? Math.round((latestState.stress || 0.2) * 100) : 0;

    const avgFocus = todayEv.length > 0
      ? Math.round(todayEv.reduce((s, e) => s + (e.focus_signal || 0.5), 0) / todayEv.length * 100)
      : 0;

    const studySessions = todayEv.filter(e => e.is_study_session).length;
    const hoursToday    = Math.round(studySessions * 0.5 * 10) / 10;

    // Flow probability
    let flowProb = 0;
    if (latestState?.flow_prob) flowProb = Math.round(latestState.flow_prob * 100);
    else if (avgEnergy > 75 && avgStress < 25) flowProb = 85;
    else if (avgEnergy > 55 && avgStress < 45) flowProb = 55;
    else flowProb = 20;

    // Topics breakdown from today's events
    const topicCounts = {};
    todayEv.forEach(e => {
      if (e.topic && e.topic !== 'general') {
        topicCounts[e.topic] = (topicCounts[e.topic] || 0) + 1;
      }
    });
    const activity = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([topic, count]) => ({
        topic,
        minutes: count * 25, // rough estimate
        cat: 'LOGGED',
      }));

    // Timeline from today's events
    const timeline = todayEv.slice(0, 8).map(e => ({
      time: new Date(e.timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: false,
        timeZone: 'Asia/Kolkata'
      }),
      event: `${e.input_type}: ${e.summary || e.topic || 'logged'}`,
    }));

    // 7-day energy trend
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dayEv = events.filter(e => e.timestamp?.startsWith(ds));
      const dayEnergy = dayEv.length > 0
        ? dayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / dayEv.length
        : 0;
      weekData.push(Math.round(dayEnergy * 10) / 10);
    }

    // Insights generated from patterns
    const insights = generateInsights(events, todayEv, avgEnergy, avgStress, streak);

    // Today's goal as a goal item
    const goals = {
      today: todayGoal ? [{ text: todayGoal, done: false, cat: 'TODAY' }] : [],
      week:  [],
    };

    const dash = {
      metrics: {
        focus:        avgFocus || avgEnergy,
        learning:     Math.round(avgEnergy * 0.9),
        productivity: flowProb,
        mood:         Math.round((1 - avgStress / 100) * 100),
        streak,
        hours_today:  hoursToday,
        tasks_done:   todayEv.filter(e => e.is_goal_mention).length,
        total_events: events.length,
        last_updated: new Date().toISOString(),
      },
      state:    latestState,
      activity: activity.length > 0 ? activity : defaultDashboard().activity,
      timeline: timeline.length > 0 ? timeline : defaultDashboard().timeline,
      weekData,
      insights,
      goals,
      streak,
    };

    return new Response(JSON.stringify(dash, null, 2), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  } catch (e) {
    console.warn('[AETHER] Dashboard compute failed:', e.message);
    return jsonResp(defaultDashboard());
  }
}

// Generate insights from event patterns
function generateInsights(events, todayEv, avgEnergy, avgStress, streak) {
  const insights = [];

  // Peak energy insight
  const hourEnergy = {};
  events.forEach(e => {
    const h = new Date(e.timestamp).getUTCHours();
    if (!hourEnergy[h]) hourEnergy[h] = [];
    hourEnergy[h].push(e.energy_signal || 0.5);
  });
  const peakHour = Object.entries(hourEnergy)
    .map(([h, vals]) => ({ h: parseInt(h), avg: vals.reduce((s,v)=>s+v,0)/vals.length }))
    .sort((a,b) => b.avg - a.avg)[0];

  if (peakHour) {
    const istHour = (peakHour.h + 5) % 24;
    const ampm = istHour >= 12 ? 'pm' : 'am';
    const h12 = istHour % 12 || 12;
    insights.push({
      icon: '⚡',
      title: 'Peak Performance Window',
      body: `Your energy peaks around ${h12}${ampm} IST based on ${events.length} logged events. Schedule your hardest tasks then.`,
      tag: 'PATTERN',
      tagClass: 'tag-ok',
    });
  }

  // Stress insight
  if (avgStress > 60) {
    insights.push({
      icon: '⚠️',
      title: 'High Stress Detected',
      body: 'Your stress signals are elevated today. Break tasks into smaller steps and take short breaks.',
      tag: 'WARNING',
      tagClass: 'tag-med',
    });
  } else if (avgEnergy > 70) {
    insights.push({
      icon: '🔥',
      title: 'High Energy Day',
      body: `Energy at ${avgEnergy}% — good conditions for deep work. Protect this window.`,
      tag: 'POSITIVE',
      tagClass: 'tag-ok',
    });
  }

  // Streak insight
  if (streak >= 3) {
    insights.push({
      icon: '🔥',
      title: `${streak}-Day Streak`,
      body: `You have logged data for ${streak} consecutive days. AETHER is building your behavioral model.`,
      tag: streak >= 7 ? 'HIGH PRIORITY' : 'POSITIVE',
      tagClass: streak >= 7 ? 'tag-hi' : 'tag-ok',
    });
  }

  // Today's activity insight
  if (todayEv.length === 0) {
    insights.push({
      icon: '💡',
      title: 'No Data Today Yet',
      body: 'Send a message to your Telegram bot to start logging today activity.',
      tag: 'ACTION',
      tagClass: 'tag-med',
    });
  }

  return insights.slice(0, 3);
}

// ═════════════════════════════════════════════════════════════════
// 5. EVENTS ENDPOINT
//    Returns raw event log — used by ML pipeline (GitHub Actions)
//    to pull data and train models
// ═════════════════════════════════════════════════════════════════

async function handleEvents(request, env) {
  const url    = new URL(request.url);
  const limit  = parseInt(url.searchParams.get('limit') || '100');
  const events = await getRecentEvents(Math.min(limit, MAX_EVENTS), env);
  return jsonResp({ count: events.length, events });
}

// ═════════════════════════════════════════════════════════════════
// 6. HEALTH CHECK
// ═════════════════════════════════════════════════════════════════


// ═════════════════════════════════════════════════════════════════
// AUTOMATION ENGINE
// POST /trigger — AETHER triggers external actions
// Called by: cron, ML pipeline, flow detection, bot commands
//
// Supported actions:
//   spotify_flow    — start focus playlist
//   notion_log      — append to Notion journal
//   webhook         — call any custom URL
//   telegram_nudge  — send smart nudge to self
// ═════════════════════════════════════════════════════════════════

async function handleTrigger(request, env) {
  try {
    const body   = await request.json();
    const action = body.action;
    const data   = body.data || {};

    console.log('[AETHER] Trigger:', action);

    switch (action) {

      // ── Smart nudge based on time + state ──────────────────────
      case 'smart_nudge': {
        const state  = await getLatestState(env);
        const events = await getRecentEvents(5, env);
        const avgE   = events.reduce((s,e) => s+(e.energy_signal||0.5),0) / Math.max(events.length,1);

        let msg;
        if (!state && events.length === 0) {
          msg = '👋 AETHER here. No data logged today yet. What are you working on?';
        } else if (avgE > 0.75) {
          msg = `⚡ You're in high energy mode. What's the hardest thing on your list right now?`;
        } else if (avgE < 0.35) {
          msg = `😴 Low energy detected. Small task or rest? Reply to log your state.`;
        } else {
          msg = `🎯 Mid-day check: still on track with your goal? Reply to update AETHER.`;
        }
        await sendTelegram(env.TELEGRAM_CHAT_ID, msg, env);
        return jsonResp({ ok: true, action, sent: msg });
      }

      // ── Notion journal entry ────────────────────────────────────
      case 'notion_log': {
        if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
          return jsonResp({ ok: false, error: 'NOTION_TOKEN and NOTION_DATABASE_ID not set' });
        }
        const events = await getRecentEvents(20, env);
        const today  = new Date().toISOString().split('T')[0];
        const todayEv = events.filter(e => e.timestamp?.startsWith(today));
        const avgE   = todayEv.length > 0
          ? Math.round(todayEv.reduce((s,e)=>s+(e.energy_signal||0.5),0)/todayEv.length*100)
          : 0;
        const topics = [...new Set(todayEv.map(e=>e.topic).filter(Boolean))].slice(0,5).join(', ');

        const resp = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization':  `Bearer ${env.NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type':   'application/json',
          },
          body: JSON.stringify({
            parent: { database_id: env.NOTION_DATABASE_ID },
            properties: {
              'Name':   { title:  [{ text: { content: `AETHER Log — ${today}` } }] },
              'Date':   { date:   { start: today } },
              'Energy': { number: avgE },
              'Events': { number: todayEv.length },
              'Topics': { rich_text: [{ text: { content: topics } }] },
            },
          }),
        });
        const notionData = await resp.json();
        return jsonResp({ ok: resp.ok, notion_id: notionData.id });
      }

      // ── Custom webhook — call any URL ───────────────────────────
      case 'webhook': {
        if (!data.url) return jsonResp({ error: 'data.url required' }, 400);
        const state  = await getLatestState(env);
        const events = await getRecentEvents(5, env);
        const payload = {
          timestamp:   new Date().toISOString(),
          state:       state,
          recent_events: events.slice(0,3),
          ...data.extra,
        };
        const resp = await fetch(data.url, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify(payload),
        });
        return jsonResp({ ok: resp.ok, status: resp.status });
      }

      // ── Spotify — open focus playlist ───────────────────────────
      case 'spotify_flow': {
        // Spotify requires OAuth — send deep link via Telegram instead
        const playlistUrl = env.SPOTIFY_FLOW_PLAYLIST || 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS';
        await sendTelegram(env.TELEGRAM_CHAT_ID,
          `🎵 *Flow playlist*
You entered flow state — time to focus.
${playlistUrl}`, env);
        return jsonResp({ ok: true, action, playlist: playlistUrl });
      }

      // ── Check-in reminder ───────────────────────────────────────
      case 'checkin_reminder': {
        const url = 'https://learning-bot.pages.dev/checkin.html';
        await sendTelegram(env.TELEGRAM_CHAT_ID,
          `📊 *Quick check-in*
How are you right now?
${url}`, env);
        return jsonResp({ ok: true });
      }

      default:
        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    }

  } catch (e) {
    console.error('[AETHER] Trigger error:', e.message);
    return jsonResp({ error: e.message }, 500);
  }
}

async function handleGitHubLog(request, env) {
  try {
    const body = await request.json();

    // Build enriched event from GitHub data
    const now   = new Date().toISOString();
    const event = {
      timestamp:        now,
      input_type:       'github',
      raw_text:         `git push: ${body.commit_message}`,
      topic:            body.topic || 'Coding',
      topics:           ['coding', 'github', body.repo?.split('/')[1] || 'project'],
      sentiment:        'positive',
      energy_signal:    parseFloat(body.energy_signal) || 0.7,
      stress_signal:    0.15,
      focus_signal:     0.8,  // coding = high focus
      motivation_signal: 0.75,
      dominant_emotion: 'neutral',
      is_study_session: true,
      is_goal_mention:  body.commit_message?.toLowerCase().includes('feat') || false,
      is_complaint:     false,
      estimated_minutes: Math.min(120, (body.files_changed || 1) * 15),
      summary:          `GitHub push: ${body.commit_message?.slice(0, 80)}`,
      // GitHub specific
      github_repo:      body.repo,
      github_branch:    body.branch,
      files_changed:    body.files_changed || 0,
      lines_added:      body.additions || 0,
      lines_deleted:    body.deletions || 0,
      // Time features
      hour_utc:         new Date().getUTCHours(),
      hour_sin:         Math.sin(2 * Math.PI * new Date().getUTCHours() / 24),
      hour_cos:         Math.cos(2 * Math.PI * new Date().getUTCHours() / 24),
      day_of_week:      new Date().getUTCDay(),
      is_weekend:       [0, 6].includes(new Date().getUTCDay()),
    };

    await saveEvent(event, env);

    // Send Telegram notification for big commits
    if ((body.files_changed || 0) >= 5 && env.TELEGRAM_CHAT_ID) {
      const msg = `⚡ *Code logged*
${body.commit_message?.slice(0,60)}
${body.files_changed} files · +${body.additions || 0} −${body.deletions || 0}`;
      await sendTelegram(env.TELEGRAM_CHAT_ID, msg, env);
    }

    console.log('[AETHER] GitHub push logged:', body.commit_message?.slice(0, 50));
    return jsonResp({ ok: true, message: 'GitHub activity logged to AETHER' });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

async function handleUpdateDashboard(request, env) {
  try {
    const dash = await request.json();
    await env.AETHER_KV.put('dashboard:latest', JSON.stringify(dash));
    return jsonResp({ ok: true, message: 'Dashboard updated from ML pipeline' });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

async function handleHealth(request, env) {
  const kvOk        = !!env.AETHER_KV;
  const openaiOk = !!env.OPENAI_API_KEY;
  const telegramOk  = !!env.TELEGRAM_BOT_TOKEN;
  const chatIdOk    = !!env.TELEGRAM_CHAT_ID;
  const whisperOk   = !!env.AI;

  const eventCount = await getEventCount(env);

  // Overall ready = core 4 are present (OpenAI is optional)
  const coreReady = kvOk && !!env.AI && telegramOk && chatIdOk;

  return jsonResp({
    status:     coreReady ? 'AETHER ONLINE ✅' : 'AETHER PARTIAL ⚠️',
    version:    '2.0',
    timestamp:  new Date().toISOString(),
    services: {
      kv:               kvOk       ? 'OK' : '❌ MISSING — create KV namespace + add to wrangler.toml',
      cf_ai:            env.AI     ? 'OK' : '❌ MISSING — add [ai] to wrangler.toml (chat, NLP, vision, voice)',
      telegram_token:   telegramOk ? 'OK' : '❌ MISSING — add TELEGRAM_BOT_TOKEN secret',
      telegram_chat_id: chatIdOk   ? 'OK' : '❌ MISSING — add TELEGRAM_CHAT_ID secret',
      openai:           openaiOk   ? 'OK' : '⚪ OPTIONAL — not required, CF AI handles everything',
    },
    data: {
      total_events: eventCount,
    },
  });
}

// ═════════════════════════════════════════════════════════════════
// NLP PARSER
// Extracts structured features from any raw text
// Uses GPT-4o-mini to understand content deeply
// ═════════════════════════════════════════════════════════════════

async function nlpParse(text, inputType, env) {
  const prompt = `You are a behavioral data parser. Extract signals from this message.

Input: "${text}"

Rules for scoring (be DECISIVE, never default to 0.5):
- energy_signal: words like "focused/great/productive/excited" = 0.8-0.95. "tired/slow/drained" = 0.1-0.3. "okay/fine" = 0.5-0.6. Action words = 0.7+
- stress_signal: "overwhelmed/stuck/confused/deadline" = 0.7-0.9. "calm/relaxed/easy" = 0.05-0.2. Neutral = 0.15-0.3
- focus_signal: studying/building/coding = 0.7-0.9. Multitasking/distracted = 0.2-0.4. General chat = 0.4-0.6
- motivation_signal: goals/targets/progress = 0.8-0.95. Complaints/giving up = 0.1-0.3
- is_study_session: true if learning, coding, reading, practicing, building
- is_goal_mention: true if mentions goal, target, plan, finish, complete, achieve

Return ONLY this JSON, no other text:
{"topic":"2-3 word subject","topics":["topic1","topic2"],"sentiment":"positive|neutral|negative","energy_signal":0.0,"stress_signal":0.0,"focus_signal":0.0,"motivation_signal":0.0,"dominant_emotion":"joy|sadness|anger|fear|surprise|neutral","is_study_session":false,"is_goal_mention":false,"is_complaint":false,"estimated_minutes":null,"summary":"one sentence"}`;

  try {
    // Use Cloudflare Workers AI — free, no OpenAI quota needed
    if (!env.AI) throw new Error('No AI binding');

    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
    });

    const raw = result?.response || '{}';
    // Extract JSON — model often wraps it in markdown or text
    let parsed = null;
    const jsonMatch = raw.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); } catch {}
    }
    // Validate parsed has required fields, else use fallback
    if (!parsed || typeof parsed.energy_signal !== 'number') {
      console.warn('[AETHER] Llama JSON invalid, using rule-based fallback');
      return fallbackNLP(text);
    }
    return parsed;

  } catch (e) {
    console.warn('[AETHER] NLP parse failed, using fallback:', e.message);
    return fallbackNLP(text);
  }
}

// Rule-based fallback if Claude call fails
function fallbackNLP(text) {
  const lower = text.toLowerCase();
  const energyWords  = ['excited', 'great', 'amazing', 'productive', 'focused', 'motivated', 'energy'];
  const stressWords  = ['stressed', 'tired', 'overwhelmed', 'anxious', 'worried', 'stuck', 'confused'];
  const studyWords   = ['learned', 'studied', 'reading', 'course', 'practice', 'revision', 'chapter'];

  const energyScore = energyWords.filter(w => lower.includes(w)).length / energyWords.length;
  const stressScore = stressWords.filter(w => lower.includes(w)).length / stressWords.length;
  const isStudy     = studyWords.some(w => lower.includes(w));

  return {
    topic:              'general',
    topics:             [],
    sentiment:          stressScore > 0.2 ? 'negative' : energyScore > 0.2 ? 'positive' : 'neutral',
    energy_signal:      Math.min(1, 0.5 + energyScore - stressScore),
    stress_signal:      Math.min(1, stressScore * 2),
    focus_signal:       0.5,
    motivation_signal:  0.5,
    dominant_emotion:   'neutral',
    is_study_session:   isStudy,
    is_goal_mention:    lower.includes('goal') || lower.includes('target') || lower.includes('plan'),
    is_complaint:       stressScore > 0.3,
    estimated_minutes:  null,
    summary:            text.slice(0, 80),
  };
}

// ═════════════════════════════════════════════════════════════════
// CLAUDE VISION
// Extracts text and topics from photos
// ═════════════════════════════════════════════════════════════════

async function openaiVisionExtract(imageUrl, caption, env) {
  // Download image from Telegram
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) throw new Error('Could not download image');

  const imgBuffer = await imgResp.arrayBuffer();
  const imgArray  = [...new Uint8Array(imgBuffer)];

  // Use Cloudflare Workers AI — free vision model
  if (!env.AI) throw new Error('AI binding missing — add [ai] to wrangler.toml');

  const prompt = caption
    ? `Image caption: "${caption}". Describe what you see in this image in English. Extract any visible text, topics, tasks or key information.`
    : 'Describe what you see in this image in English only. List any visible text, objects, activities, or key information. If you cannot read text clearly, describe the visual content instead. Never invent text that is not visible.';

  const result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', {
    image:    imgArray,
    prompt:   prompt,
    max_tokens: 512,
  });

  if (!result?.description) throw new Error('Vision model returned empty result');
  return result.description;
}

// ═════════════════════════════════════════════════════════════════
// WHISPER — Voice/Video → Text
// ═════════════════════════════════════════════════════════════════

async function whisperTranscribe(audioUrl, env) {
  // Download audio from Telegram CDN
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error('Could not download audio file');

  const audioBuffer = await audioResponse.arrayBuffer();

  // Cloudflare Workers AI — free Whisper, no OpenAI billing
  if (!env.AI) throw new Error('AI binding missing — add [ai] to wrangler.toml');

  // CF Whisper has a ~25MB file size limit and ~30s timeout
  if (audioBuffer.byteLength > 25 * 1024 * 1024) {
    throw new Error('Audio file too large (max 25MB). Keep voice notes under 5 minutes.');
  }

  const result = await env.AI.run('@cf/openai/whisper', {
    audio: [...new Uint8Array(audioBuffer)],
  });

  // CF Whisper returns { text, word_count, segments }
  const transcript = result?.text || result?.transcription || '';
  if (!transcript.trim()) throw new Error('Could not transcribe — try speaking more clearly or send as text.');
  return transcript.trim();
}

// ═════════════════════════════════════════════════════════════════
// TELEGRAM HELPERS
// ═════════════════════════════════════════════════════════════════

// Get direct download URL for a file
async function getTelegramFileUrl(fileId, env) {
  const resp = await fetch(
    `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`
  );
  const data = await resp.json();
  if (!data.ok) throw new Error('Telegram getFile failed: ' + JSON.stringify(data));
  const filePath = data.result.file_path;
  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
}

// Send a message back to user
async function sendTelegram(chatId, text, env) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id:    chatId,
        text:       text,
        parse_mode: 'Markdown',
      }),
    });
  } catch (e) {
    console.warn('[AETHER] sendTelegram failed:', e.message);
  }
}

// Build the reply message shown after each Telegram input
function buildTelegramReply(parsed, inputType, rawText) {
  const icons = {
    text:       '📝',
    voice:      '🎙',
    video_note: '🎥',
    image:      '🖼',
    document:   '📄',
    goal:       '🎯',
    mood:       '😊',
    checkin:    '✅',
  };

  const icon      = icons[inputType] || '📨';
  const energy    = Math.round((parsed.energy_signal || 0.5) * 100);
  const stress    = Math.round((parsed.stress_signal || 0.2) * 100);
  const focus     = Math.round((parsed.focus_signal  || 0.5) * 100);
  const sentiment = parsed.sentiment || 'neutral';
  const topic     = parsed.topic || 'general';
  const summary   = parsed.summary || rawText.slice(0, 80);

  // Flow state label
  let flowLabel;
  if      (energy > 80 && stress < 20) flowLabel = '🟢 FLOW ZONE';
  else if (energy > 60 && stress < 40) flowLabel = '🟡 PRE-FLOW';
  else if (stress > 65)                flowLabel = '🔴 HIGH STRESS';
  else if (energy < 25)                flowLabel = '⚫ LOW ENERGY';
  else                                 flowLabel = '⚪ NOMINAL';

  // Emoji for sentiment
  const moodEmoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😔' : '😐';

  // Image gets a simpler reply showing what was seen
  if (inputType === 'image') {
    return `🖼 *Image logged*\n\n` +
      `Seen: ${summary}\n` +
      `Topic: ${topic}\n\n` +
      `⚡ ${energy}%  😤 ${stress}%  🎯 ${focus}%  ${flowLabel}`;
  }

  // Voice gets transcript confirmation
  if (inputType === 'voice' || inputType === 'video_note') {
    return `🎙 *Voice logged*\n\n` +
      `"_${summary}_"\n\n` +
      `Topic: ${topic}  ${moodEmoji} ${sentiment}\n` +
      `⚡ ${energy}%  😤 ${stress}%  🎯 ${focus}%\n${flowLabel}`;
  }

  // Standard text reply
  return `${icon} *Logged* · ${topic}\n` +
    `${moodEmoji} ${sentiment}  ⚡ ${energy}%  😤 ${stress}%  🎯 ${focus}%\n` +
    `${flowLabel}\n` +
    `_${summary.slice(0, 100)}_`;
}

// ═════════════════════════════════════════════════════════════════
// CLAUDE CHAT
// Called by /chat endpoint for the dashboard AI assistant
// ═════════════════════════════════════════════════════════════════

function buildSystemPrompt(metrics, activity, goals, recentEvents, latestState) {
  const stateContext = latestState
    ? `\nUser's current state (from check-in): ${latestState.state_label}, energy: ${latestState.energy}, stress: ${latestState.stress}, flow class: ${latestState.flow_class}`
    : '';

  const eventsContext = recentEvents.length > 0
    ? `\nRecent activity (last ${recentEvents.length} events):\n` +
      recentEvents.map(e =>
        `- [${e.timestamp?.split('T')[0]}] ${e.input_type}: ${e.topic || e.summary || 'logged'} | energy:${((e.energy_signal||0.5)*100).toFixed(0)}%`
      ).join('\n')
    : '';

  return `You are AETHER, a personal AI operating system and coach for Avi. You are intelligent, direct, and deeply personal. You know Avi's patterns, productivity data, and behavioral history.

You are NOT a generic assistant. You speak like a trusted system that has been watching Avi's data for months. Be concise, insightful, and occasionally push Avi to do better.

Current dashboard metrics:
- Focus: ${metrics.focus || 0}%
- Learning: ${metrics.learning || 0}%  
- Productivity: ${metrics.productivity || 0}%
- Mood: ${metrics.mood || 0}%
${stateContext}
${eventsContext}

Today's goals: ${goals.map(g => g.text || g).join(', ') || 'none set'}
Today's activity: ${activity.map(a => `${a.topic} (${a.minutes}min)`).join(', ') || 'none logged'}

Rules:
- Be direct and personal. Use "you" not "one".
- Reference actual data when relevant. 
- Keep responses under 150 words unless detail is genuinely needed.
- When Avi seems stressed or low energy, acknowledge it first before advice.
- You can be slightly sarcastic when Avi is making excuses.
- Always end with one concrete action if the question is about productivity.`;
}

async function callOpenAI(systemPrompt, history, env) {
  // Convert history to OpenAI format (prepend system message)
  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
  ];

  // Use Cloudflare Workers AI — free Llama 3
  if (!env.AI) throw new Error('AI binding missing');

  const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages,
    max_tokens: 400,
  });

  return result?.response || 'No response from AI.';
}


// ═════════════════════════════════════════════════════════════════
// MORNING BRIEFING — runs at 8:30am IST via cron
// ═════════════════════════════════════════════════════════════════

async function sendMorningBriefing(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const today      = new Date().toISOString().split('T')[0];
  const events     = await getRecentEvents(50, env);
  const todayGoal  = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);
  const latestState = await getLatestState(env);

  // Calculate yesterday stats
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const ydStr = yesterday.toISOString().split('T')[0];
  const ydEvents = events.filter(e => e.timestamp?.startsWith(ydStr));
  const avgEnergy = ydEvents.length > 0
    ? Math.round(ydEvents.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / ydEvents.length * 100)
    : null;

  // Streak calculation
  const streak = await calculateStreak(events);

  // Day of week motivation
  const days = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  const dayName = days[new Date().getDay()];

  let msg = `🌅 *Good morning, Avi!*

`;
  msg += `📅 ${dayName} · ${today}
`;
  msg += `🔥 Streak: ${streak} day${streak !== 1 ? 's' : ''}

`;

  if (avgEnergy !== null) {
    msg += `Yesterday: ⚡ ${avgEnergy}% energy · ${ydEvents.length} events logged

`;
  }

  if (todayGoal) {
    msg += `🎯 *Today's goal:* ${todayGoal}

`;
  } else {
    msg += `💡 Set your goal: /goal [what you want to achieve today]

`;
  }

  // Motivational nudge based on streak
  if (streak === 0)      msg += `_Start your streak today — just send one message._`;
  else if (streak < 3)   msg += `_${streak} days in. Keep the momentum going._`;
  else if (streak < 7)   msg += `_${streak} days strong. You're building a habit._`;
  else if (streak < 30)  msg += `_${streak} day streak. AETHER is learning your patterns._`;
  else                   msg += `_${streak} days. The model knows you well now._`;

  await sendTelegram(chatId, msg, env);
}

// ═════════════════════════════════════════════════════════════════
// EVENING SUMMARY — runs at 8:30pm IST via cron
// ═════════════════════════════════════════════════════════════════

async function sendEveningSummary(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const today   = new Date().toISOString().split('T')[0];
  const events  = await getRecentEvents(100, env);
  const todayEv = events.filter(e => e.timestamp?.startsWith(today));
  const goal    = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);
  const state   = await getLatestState(env);

  if (todayEv.length === 0) {
    await sendTelegram(chatId,
      `🌙 *Evening check-in*

No activity logged today, Avi.

Tomorrow: start with one message to AETHER when you wake up.

_Consistency beats intensity._`, env);
    return;
  }

  const avgEnergy = Math.round(todayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / todayEv.length * 100);
  const avgStress = Math.round(todayEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / todayEv.length * 100);
  const topics    = [...new Set(todayEv.map(e => e.topic).filter(Boolean))].slice(0, 4);
  const studyMins = todayEv.filter(e => e.is_study_session).length * 30; // rough estimate
  const streak    = await calculateStreak(events);

  // Flow assessment
  let flowSummary;
  if      (avgEnergy > 75 && avgStress < 25) flowSummary = '🟢 Strong flow day';
  else if (avgEnergy > 55 && avgStress < 45) flowSummary = '🟡 Decent focus day';
  else if (avgStress > 65)                   flowSummary = '🔴 High stress day — rest tonight';
  else if (avgEnergy < 30)                   flowSummary = '⚫ Low energy day — sleep early';
  else                                        flowSummary = '⚪ Normal day';

  let msg = `🌙 *AETHER Daily Summary*

`;
  msg += `📊 ${todayEv.length} events logged
`;
  msg += `⚡ Avg energy: ${avgEnergy}%
`;
  msg += `😤 Avg stress: ${avgStress}%
`;
  msg += `${flowSummary}

`;

  if (topics.length > 0) msg += `🧠 Topics: ${topics.join(', ')}
`;
  if (goal)              msg += `🎯 Goal was: ${goal}
`;
  msg += `🔥 Streak: ${streak} days

`;

  // Tomorrow nudge
  const hour = new Date().getHours();
  if (avgEnergy < 40 || avgStress > 60) {
    msg += `_Rest well tonight. Recovery is productive._`;
  } else {
    msg += `_Good work today. Log your state tomorrow morning to keep AETHER learning._`;
  }

  await sendTelegram(chatId, msg, env);
}


// ─── Midday nudge — checks if user logged anything today ──────────
async function middayNudge(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;
  const today   = new Date().toISOString().split('T')[0];
  const events  = await getRecentEvents(20, env);
  const todayEv = events.filter(e => e.timestamp?.startsWith(today)
                                  && e.input_type !== 'checkin');
  if (todayEv.length === 0) {
    await sendTelegram(chatId,
      `🌞 *Midday check*

No activity logged yet today.
What are you working on?

Just reply or use /goal to set your focus.`, env);
  }
}

// ─── Streak calculator ────────────────────────────────────────────
async function calculateStreak(events) {
  const days = new Set(events.map(e => e.timestamp?.split('T')[0]).filter(Boolean));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (days.has(ds)) streak++;
    else if (i > 0) break; // gap found
  }
  return streak;
}

// ═════════════════════════════════════════════════════════════════
// KV STORAGE HELPERS
// All data is stored in Cloudflare KV (key-value store)
// Keys used:
//   events:list      → JSON array of all events (capped at MAX_EVENTS)
//   events:count     → integer count
//   state:YYYY-MM-DD → daily state vector from check-in
//   dashboard:latest → latest dashboard.json for UI
// ═════════════════════════════════════════════════════════════════

async function saveEvent(event, env) {
  if (!env.AETHER_KV) {
    console.warn('[AETHER] KV not available, event not saved');
    return;
  }
  try {
    const raw    = await env.AETHER_KV.get('events:list');
    const events = raw ? JSON.parse(raw) : [];

    events.unshift(event);
    if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS);

    await env.AETHER_KV.put('events:list', JSON.stringify(events));
    await env.AETHER_KV.put('events:count', String(events.length));

    // Auto-trigger ML pipeline every 5 real events (not commands/checkins)
    const realTypes = ['text', 'voice', 'image', 'document', 'video_note'];
    if (realTypes.includes(event.input_type)) {
      const realCount = events.filter(e => realTypes.includes(e.input_type)).length;
      if (realCount >= 10 && realCount % 5 === 0 && env.GITHUB_TOKEN) {
        triggerMLPipeline(env).catch(e =>
          console.warn('[AETHER] ML trigger failed:', e.message)
        );
      }
    }
  } catch (e) {
    console.error('[AETHER] saveEvent failed:', e.message);
  }
}

// Trigger GitHub Actions ML pipeline via API
async function triggerMLPipeline(env) {
  if (!env.GITHUB_TOKEN) return;
  console.log('[AETHER] Triggering ML pipeline...');
  const resp = await fetch(
    'https://api.github.com/repos/talpadeavi03/learning-bot/actions/workflows/ml_pipeline.yml/dispatches',
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${env.GITHUB_TOKEN}`,
        'Accept':        'application/vnd.github.v3+json',
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({ ref: 'master' }),
    }
  );
  console.log('[AETHER] ML pipeline triggered:', resp.status);
}

async function getRecentEvents(limit, env) {
  if (!env.AETHER_KV) return [];
  try {
    const raw = await env.AETHER_KV.get('events:list');
    if (!raw) return [];
    const events = JSON.parse(raw);
    return events.slice(0, limit);
  } catch {
    return [];
  }
}

async function getEventCount(env) {
  if (!env.AETHER_KV) return 0;
  try {
    const count = await env.AETHER_KV.get('events:count');
    return parseInt(count || '0');
  } catch {
    return 0;
  }
}

async function getLatestState(env) {
  if (!env.AETHER_KV) return null;
  try {
    const today = new Date().toISOString().split('T')[0];
    const raw   = await env.AETHER_KV.get(`state:${today}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Refresh dashboard.json in KV when a new state is logged
async function refreshDashboardFromState(stateVector, env) {
  if (!env.AETHER_KV) return;
  try {
    // Load existing dashboard or start fresh
    const existing = await env.AETHER_KV.get('dashboard:latest');
    const dash     = existing ? JSON.parse(existing) : defaultDashboard();

    // Update metrics from state vector
    dash.metrics.focus        = Math.round((stateVector.energy || 0.5) * 100);
    dash.metrics.mood         = Math.round(((1 - (stateVector.stress || 0.2)) * 100));
    dash.metrics.productivity = Math.round((stateVector.flow_prob || 0.3) * 100);
    dash.metrics.last_updated = new Date().toISOString();
    dash.state                = stateVector;

    await env.AETHER_KV.put('dashboard:latest', JSON.stringify(dash));
  } catch (e) {
    console.warn('[AETHER] refreshDashboard failed:', e.message);
  }
}

// Default dashboard structure before any real data
function defaultDashboard() {
  return {
    metrics: {
      focus:        0,
      learning:     0,
      productivity: 0,
      mood:         0,
      last_updated: null,
    },
    state:    null,
    activity: [],
    goals:    { today: [], week: [] },
    insights: [],
    streak:   0,
  };
}
