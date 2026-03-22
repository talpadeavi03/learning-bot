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
      if (url.pathname === '/reset-data'        && request.method === 'POST') return handleResetData(request, env);
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
    word_count:      wo