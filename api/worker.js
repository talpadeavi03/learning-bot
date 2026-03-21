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

  // ── Save event to KV ─────────────────────────────────────────
  const event = {
    timestamp,
    input_type: inputType,
    raw_text:   rawText.slice(0, 1000), // trim to avoid KV bloat
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
    const raw = await env.AETHER_KV.get('dashboard:latest');
    if (raw) {
      return new Response(raw, {
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
      });
    }
  } catch (e) {
    console.warn('[AETHER] KV dashboard read failed:', e.message);
  }

  // No data yet — return empty defaults
  return jsonResp(defaultDashboard());
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
  const prompt = `You are AETHER's data parser. Analyze this input and extract structured data.

Input type: ${inputType}
Text: "${text}"

Return ONLY valid JSON with exactly these fields:
{
  "topic": "main subject in 2-3 words",
  "topics": ["list", "of", "topics"],
  "sentiment": "positive|neutral|negative",
  "energy_signal": 0.0-1.0,
  "stress_signal": 0.0-1.0,
  "focus_signal": 0.0-1.0,
  "motivation_signal": 0.0-1.0,
  "dominant_emotion": "joy|sadness|anger|fear|surprise|neutral",
  "is_study_session": true/false,
  "is_goal_mention": true/false,
  "is_complaint": true/false,
  "estimated_minutes": number or null,
  "summary": "one sentence summary"
}

Base energy_signal on language energy (excited=0.9, tired=0.2, neutral=0.5).
Base stress_signal on anxiety/overwhelm words (calm=0.1, stressed=0.8).
Return ONLY the JSON object, no other text.`;

  try {
    // Use Cloudflare Workers AI — free, no OpenAI quota needed
    if (!env.AI) throw new Error('No AI binding');

    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
    });

    const raw    = result?.response || '{}';
    // Extract JSON from response (model may wrap it in text)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : JSON.parse(raw.trim());
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
    ? `Image caption: "${caption}". Extract all text, topics, tasks, and key information visible in this image.`
    : 'Extract all text, topics, tasks, and key information visible in this image. Include any handwritten notes, diagrams labels or text you can see. Be thorough.';

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

  const result = await env.AI.run('@cf/openai/whisper', {
    audio: [...new Uint8Array(audioBuffer)],
  });

  if (!result?.text) throw new Error('Whisper returned empty transcript');
  return result.text;
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
  };

  const icon      = icons[inputType] || '📨';
  const energy    = Math.round((parsed.energy_signal    || 0.5) * 100);
  const stress    = Math.round((parsed.stress_signal    || 0.1) * 100);
  const focus     = Math.round((parsed.focus_signal     || 0.5) * 100);
  const sentiment = parsed.sentiment || 'neutral';

  let flowLabel = '—';
  if (energy > 75 && stress < 25)      flowLabel = '🟢 FLOW ZONE';
  else if (energy > 55 && stress < 45) flowLabel = '🟡 PRE-FLOW';
  else if (stress > 60)                flowLabel = '🔴 HIGH STRESS';
  else if (energy < 30)                flowLabel = '⚫ LOW ENERGY';
  else                                 flowLabel = '⚪ NOMINAL';

  return `${icon} *AETHER logged*\n\n` +
    `📊 *Analysis*\n` +
    `Topic: ${parsed.topic || 'general'}\n` +
    `Mood: ${sentiment} · ${parsed.dominant_emotion || 'neutral'}\n\n` +
    `⚡ Energy: ${energy}%\n` +
    `😤 Stress: ${stress}%\n` +
    `🎯 Focus: ${focus}%\n\n` +
    `${flowLabel}\n\n` +
    `_${parsed.summary || rawText.slice(0, 60)}_`;
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
    // Get existing events
    const raw    = await env.AETHER_KV.get('events:list');
    const events = raw ? JSON.parse(raw) : [];

    // Prepend new event (newest first)
    events.unshift(event);

    // Cap at MAX_EVENTS
    if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS);

    await env.AETHER_KV.put('events:list', JSON.stringify(events));
    await env.AETHER_KV.put('events:count', String(events.length));
  } catch (e) {
    console.error('[AETHER] saveEvent failed:', e.message);
  }
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