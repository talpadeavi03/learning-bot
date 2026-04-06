// ═════════════════════════════════════════════════════════════════
// BOT COMMANDS
// /stats  — weekly summary
// /flow   — current flow state
// /goal   — set today's goal
// /mood   — quick mood log
// /help   — list commands
// ═════════════════════════════════════════════════════════════════

async function sendJarvisAlert(env, chatId, type, message) {
  const lastAlert = await env.AETHER_KV.get("last_alert");

  // ❌ prevent spam (same alert)
  if (lastAlert === type) return;

  // ✅ Telegram (primary)
  await sendTelegram(chatId, message, env);

  // 📱 Push (secondary)
  const sub = await env.AETHER_KV.get("push:sub", { type: "json" });

  if (sub) {
    try {
      await fetch(sub.endpoint, {
        method: "POST",
        body: JSON.stringify({
          title: "AETHER",
          body: message
        })
      });
    } catch (e) {
      console.log("Push failed:", e.message);
    }
  }

  // 🧠 remember last alert
  await env.AETHER_KV.put("last_alert", type);
}

function analyzePatterns(events) {
  if (events.length < 10) {
    return {
      bestHour: "--",
      trend: "collecting data"
    };
  }

  // 🕒 Hourly energy pattern
  const hourMap = {};
  events.forEach(e => {
    const h = new Date(e.timestamp).getUTCHours();
    if (!hourMap[h]) hourMap[h] = [];
    hourMap[h].push(e.energy_signal || 0.5);
  });

  let bestHour = 0;
  let bestEnergy = 0;

  for (const h in hourMap) {
    const avg = hourMap[h].reduce((s, v) => s + v, 0) / hourMap[h].length;
    if (avg > bestEnergy) {
      bestEnergy = avg;
      bestHour = h;
    }
  }

  // 📉 Energy trend (last 2 days)
  const recent = events.slice(-10).map(e => e.energy_signal || 0.5);
  const trendDiff = recent[recent.length - 1] - recent[0];

  let trend = "stable";
  if (trendDiff > 0.1) trend = "improving";
  if (trendDiff < -0.1) trend = "declining";

  return {
    bestHour,
    bestEnergy,
    trend
  };
}

async function getRecentEvents(envOrLimit, limitOrEnv) {
  // handle both getRecentEvents(env, 20) and getRecentEvents(20, env)
  const env  = typeof envOrLimit === 'number' ? limitOrEnv : envOrLimit;
  const limit = typeof envOrLimit === 'number' ? envOrLimit : (limitOrEnv || 20);
  const events = await env.AETHER_KV.get("events:list", { type: "json" }) || [];
  return events.slice(-limit);
}

async function getDashboard(env) {
  return await env.AETHER_KV.get("dashboard:latest", { type: "json" }) || {};
}

function analyzeState(events, dashboard) {
  if (!events.length) return { state: "unknown" };

  const last = events[events.length - 1];

  const energy = last.energy_signal ?? dashboard.avg_energy ?? 0.5;
  const stress = last.stress_signal ?? dashboard.avg_stress ?? 0.3;
  const focus = last.focus_signal ?? 0.5;

  let state = "neutral";
  let advice = "";

  // 🧠 CORE DECISION LOGIC
  if (energy < 0.3 && stress > 0.6) {
    state = "burnout";
    advice = "You’re mentally drained. Take a full break. No heavy tasks.";
  }
  else if (focus < 0.4) {
    state = "low_focus";
    advice = "Your focus is low. Do small tasks or reset (walk, water, no screens).";
  }
  else if (energy > 0.7 && focus > 0.6) {
    state = "flow_ready";
    advice = "You are in peak state. Start deep work NOW.";
  }
  else {
    state = "moderate";
    advice = "Maintain momentum. Avoid distractions and continue current work.";
  }

  return {
    state,
    energy,
    stress,
    focus,
    advice
  };
}

async function handleCommand(text, chatId, env) {
  const parts = text.trim().split(' ');
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(' ');

  switch (command) {
    case '/help':
    case '/start': {
      await sendTelegram(chatId,
        `🤖 *AETHER OS — Commands*\n\n` +
        `/stats — weekly performance summary\n` +
        `/flow  — are you in flow right now?\n` +
        `/goal  — set today's main goal\n` +
        `/mood  — quick mood check-in\n` +
        `/week  — 7-day activity overview\n\n` +
        `Or just send any message, voice note, or photo and AETHER will log it.`, env);
      return true;
    }

    case '/stats': {
      const events = await getRecentEvents(env, 50);
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
        `📊 *AETHER Weekly Stats*\n\n` +
        `Events logged: ${events.length}\n` +
        `Study sessions: ${studySessions}\n` +
        `Check-ins: ${checkins}\n\n` +
        `⚡ Avg energy: ${Math.round(avgEnergy * 100)}%\n` +
        `😤 Avg stress: ${Math.round(avgStress * 100)}%\n\n` +
        `🧠 Topics: ${topics.join(', ') || 'none yet'}\n\n` +
        `Keep logging — model trains after 30 days!`, env);
      return true;
    }

    case '/flow': {
      const events = await getRecentEvents(env, 20);
      const state = await getLatestState(env);
      const recentEnergy = events.length > 0
        ? events.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / events.length : 0.5;
      const recentStress = events.length > 0
        ? events.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / events.length : 0.2;

      let flowStatus, advice;
      if (state?.flow_class) {
        flowStatus = state.flow_class;
        if (flowStatus === 'FLOW') advice = 'You are in flow. Protect this time.';
        else if (flowStatus === 'PRE_FLOW') advice = 'Almost there. One focused task to enter flow.';
        else if (flowStatus === 'ANXIETY') advice = 'Challenge too high. Break the task into smaller pieces.';
        else if (flowStatus === 'RECOVERY') advice = 'Rest mode. Light tasks only.';
        else advice = 'Log your state with the check-in to get a flow reading.';
      } else if (recentEnergy > 0.7 && recentStress < 0.3) {
        flowStatus = 'FLOW'; advice = 'Recent messages suggest flow. Stay focused!';
      } else {
        flowStatus = 'NOMINAL'; advice = 'Open the AETHER dashboard and log your state for a precise reading.';
      }
      await sendTelegram(chatId, `🎯 *Flow State: ${flowStatus}*\n\n${advice}\n\nEnergy: ${Math.round(recentEnergy * 100)}% · Stress: ${Math.round(recentStress * 100)}%`, env);
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
        timestamp: new Date().toISOString(),
        input_type: 'goal',
        raw_text: args,
        topic: 'goal setting',
        sentiment: 'positive',
        energy_signal: 0.7,
        stress_signal: 0.1,
        is_goal_mention: true,
        summary: args,
      }, env);
      await sendTelegram(chatId, `✅ Goal set: *${args}*\n\nAETHER will track this today.`, env);
      return true;
    }

    case '/mood': {
      const moodMap = {
        '1': { label: 'Very low', energy: 0.1, stress: 0.6 },
        '2': { label: 'Low', energy: 0.3, stress: 0.4 },
        '3': { label: 'Neutral', energy: 0.5, stress: 0.3 },
        '4': { label: 'Good', energy: 0.7, stress: 0.2 },
        '5': { label: 'Excellent', energy: 0.9, stress: 0.1 },
      };
      if (!args || !moodMap[args]) {
        await sendTelegram(chatId, '😊 Rate your mood: /mood 1-5 (1=very low, 3=neutral, 5=excellent)', env);
        return true;
      }
      const mood = moodMap[args];
      await saveEvent({
        timestamp: new Date().toISOString(),
        input_type: 'mood',
        raw_text: `mood: ${mood.label}`,
        topic: 'mood check-in',
        energy_signal: mood.energy,
        stress_signal: mood.stress,
        sentiment: args >= '4' ? 'positive' : args === '3' ? 'neutral' : 'negative',
        summary: `Mood rated ${args}/5: ${mood.label}`,
      }, env);
      await sendTelegram(chatId,
        `${args >= '4' ? '😊' : args === '3' ? '😐' : '😔'} Mood logged: *${mood.label}* (${args}/5)\n\nEnergy: ${Math.round(mood.energy * 100)}%`, env);
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
        const avg = d.energy.reduce((s, v) => s + v, 0) / d.energy.length;
        const bar = '█'.repeat(Math.round(avg * 5)) + '░'.repeat(5 - Math.round(avg * 5));
        return `${day}: ${bar} ${d.count} events`;
      }).join('\n');
      await sendTelegram(chatId,
        `📅 *7-Day Activity*\n\n\`\`\`\n${dayLines || 'No data yet'}\n\`\`\`\n\nKeep logging daily!`, env);
      return true;
    }

    case '/trace': {

      const fn = args.trim()

      if (!fn) {
        await sendTelegram(
          chatId,
          "Usage: /trace functionName\nExample: /trace triggerMLPipeline",
          env
        )
        return true
      }

      const raw = await env.AETHER_KV.get("code_graph")

      if (!raw) {
        await sendTelegram(chatId, "Code graph not loaded.", env)
        return true
      }

      const graph = JSON.parse(raw)

      function trace(target, visited = new Set()) {

        if (visited.has(target)) return []

        visited.add(target)

        const callers = graph.edges
          .filter(e => e.to === target)
          .map(e => e.from)

        if (callers.length === 0) {
          return [[target]]
        }

        let paths = []

        for (const caller of callers) {

          const subPaths = trace(caller, visited)

          for (const p of subPaths) {
            paths.push([...p, target])
          }

        }

        return paths
      }

      const paths = trace(fn)

      if (!paths.length) {
        await sendTelegram(chatId, `No trace found for ${fn}`, env)
        return true
      }

      let msg = `🧠 Code Trace for *${fn}*\n\n`

      paths.forEach((p, i) => {
        msg += `Flow ${i + 1}\n`
        msg += p.join("\n↓\n")
        msg += "\n\n"
      })

      await sendTelegram(chatId, msg, env)

      return true
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
        'notion': 'notion_log',
        'spotify': 'spotify_flow',
        'nudge': 'smart_nudge',
        'checkin': 'checkin_reminder',
      };
      if (subAction === 'webhook') {
        const webhookUrl = args.split(' ')[1];
        if (!webhookUrl) {
          await sendTelegram(chatId, '⚠️ Usage: /automate webhook https://yoururl.com', env);
          return true;
        }
        await handleTrigger(new Request('https://x/trigger', {
          method: 'POST',
          body: JSON.stringify({ action: 'webhook', data: { url: webhookUrl } }),
        }), env);
        await sendTelegram(chatId, '✅ Webhook triggered!', env);
        return true;
      }
      const mappedAction = actionMap[subAction];
      if (!mappedAction) {
        await sendTelegram(chatId, `⚠️ Unknown automation: ${subAction}. Try /automate for list.`, env);
        return true;
      }
      await handleTrigger(new Request('https://x/trigger', {
        method: 'POST',
        body: JSON.stringify({ action: mappedAction }),
      }), env);
      return true;
    }

    case '/streak': {
      const events = await getRecentEvents(100, env);
      const streak = await calculateStreak(events);
      const total = events.length;
      await sendTelegram(chatId,
        `🔥 *Streak: ${streak} day${streak !== 1 ? 's' : ''}*\n\n` +
        `Total events logged: ${total}\n` +
        `Keep logging daily to maintain your streak!`, env);
      return true;
    }

    case '/exercise':
    case '/workout': {
      const actType = args.replace(/[0-9]+/g, '').trim() || 'workout';
      const mins = parseInt(args.match(/[0-9]+/)?.[0]) || 30;
      const strGain = Math.min(10, Math.round(mins / 6));
      await saveEvent({
        timestamp: new Date().toISOString(),
        input_type: 'health', raw_text: text, topic: 'Exercise',
        topics: ['health', 'fitness', actType],
        life_dimension: 'fitness',
        stat_impact: { INT: 0, STR: mins / 60, VIT: 0.3, AGI: 0.2, SEN: 0 },
        energy_signal: 0.8, stress_signal: 0.1, focus_signal: 0.7, motivation_signal: 0.85,
        dominant_emotion: 'energized', is_study_session: false, is_goal_mention: true, is_win: mins >= 30,
        health_type: 'exercise', exercise_minutes: mins, exercise_type: actType,
        summary: `Exercise: ${actType} for ${mins} min`,
      }, env);
      await sendTelegram(chatId, `💪 *Workout logged*\n\n[STR +${strGain}] Strength building\n${actType} · ${mins} min\n\n${mins >= 45 ? '🔥 Solid session!' : '✅ Done!'}`, env);
      return true;
    }


    case '/sleep': {
      const hrs = parseFloat(args) || 7;
      const quality = hrs >= 8 ? 'great' : hrs >= 6 ? 'ok' : 'poor';
      const energy = hrs >= 8 ? 0.85 : hrs >= 6 ? 0.6 : 0.35;
      await saveEvent({
        input_type: 'health', raw_text: text, topic: 'Sleep',
        topics: ['health', 'sleep', 'recovery'], energy_signal: energy,
        stress_signal: hrs < 6 ? 0.5 : 0.1, focus_signal: energy,
        motivation_signal: energy, dominant_emotion: hrs < 6 ? 'tired' : 'rested',
        is_study_session: false, is_goal_mention: false,
        health_type: 'sleep', sleep_hours: hrs, sleep_quality: quality,
        summary: `Sleep: ${hrs}h (${quality})`,
      }, env);
      await sendTelegram(chatId,
        `😴 *Sleep logged*\n\n${hrs}h — ${quality.toUpperCase()}\nEnergy forecast: ${Math.round(energy * 100)}%\n\n` +
        `${hrs < 6 ? '⚠️ Low sleep — take it easy.' : hrs >= 8 ? '✅ Well rested!' : '👍 Decent sleep.'}`, env);
      return true;
    }

    case '/food':
    case '/meal': {
      const meal = args || 'meal';
      await saveEvent({
        input_type: 'health', raw_text: text, topic: 'Food',
        topics: ['health', 'nutrition'], energy_signal: 0.5, stress_signal: 0.05,
        focus_signal: 0.4, motivation_signal: 0.5, dominant_emotion: 'neutral',
        is_study_session: false, is_goal_mention: false,
        health_type: 'food', meal_description: meal, summary: `Meal: ${meal}`,
      }, env);
      await sendTelegram(chatId, `🍽️ *Meal logged*\n\n${meal}\n\nFuel in the tank! 💪`, env);
      return true;
    }

    case '/water':
    case '/hydrate': {
      const litres = parseFloat(args) || 0.5;
      await saveEvent({
        input_type: 'health', raw_text: text, topic: 'Hydration',
        topics: ['health', 'water'], energy_signal: 0.55, stress_signal: 0.05,
        focus_signal: 0.5, motivation_signal: 0.55, dominant_emotion: 'neutral',
        health_type: 'water', litres, summary: `Water: ${litres}L`,
      }, env);
      await sendTelegram(chatId, `💧 *Water logged*\n\n${litres}L\n\nBrain runs on water 🧠`, env);
      return true;
    }

    case '/weight': {
      const kg = parseFloat(args);
      if (!kg || kg < 30 || kg > 250) {
        await sendTelegram(chatId, '⚖️ Usage: /weight 72.5', env);
        return true;
      }
      await saveEvent({
        input_type: 'health', raw_text: text, topic: 'Weight',
        topics: ['health', 'fitness'], energy_signal: 0.5, stress_signal: 0.1,
        focus_signal: 0.5, motivation_signal: 0.6, dominant_emotion: 'neutral',
        health_type: 'weight', weight_kg: kg, summary: `Weight: ${kg}kg`,
      }, env);
      await sendTelegram(chatId, `⚖️ *Weight logged*\n\n${kg} kg\n\nTracking → trending → improving 📈`, env);
      return true;
    }

    case '/spend':
    case '/expense': {
      if (!args) { await sendTelegram(chatId, '💸 Usage: /spend 200 food', env); return true; }
      const spendParts = args.split(' ');
      const amount = parseFloat(spendParts[0]) || 0;
      const cat = spendParts.slice(1).join(' ') || 'general';
      await saveEvent({
        input_type: 'finance', raw_text: text, topic: 'Expense',
        topics: ['money', 'spending', cat], energy_signal: 0.5, stress_signal: 0.15,
        focus_signal: 0.4, motivation_signal: 0.5, dominant_emotion: 'neutral',
        finance_type: 'expense', amount_inr: amount, category: cat,
        summary: `Spent Rs${amount} on ${cat}`,
      }, env);
      await sendTelegram(chatId, `💸 *Expense logged*\n\nRs${amount} — ${cat}\n\nEvery rupee tracked 💰`, env);
      return true;
    }

    case '/income':
    case '/earn': {
      if (!args) { await sendTelegram(chatId, '💰 Usage: /income 5000 freelance', env); return true; }
      const earnParts = args.split(' ');
      const earned = parseFloat(earnParts[0]) || 0;
      const src = earnParts.slice(1).join(' ') || 'income';
      await saveEvent({
        input_type: 'finance', raw_text: text, topic: 'Income',
        topics: ['money', 'income', src], energy_signal: 0.85, stress_signal: 0.05,
        focus_signal: 0.7, motivation_signal: 0.9, dominant_emotion: 'joy',
        finance_type: 'income', amount_inr: earned, source: src,
        summary: `Income: Rs${earned} from ${src}`,
      }, env);
      await sendTelegram(chatId, `💰 *Income logged*\n\nRs${earned} from ${src}\n\nMoney flowing in! Keep building 🚀`, env);
      return true;
    }

    case '/job':
    case '/apply': {
      const company = args || 'company';
      await saveEvent({
        input_type: 'career', raw_text: text, topic: 'Job Application',
        topics: ['career', 'jobs'], energy_signal: 0.7, stress_signal: 0.3,
        focus_signal: 0.6, motivation_signal: 0.75, dominant_emotion: 'determined',
        career_type: 'application', company, summary: `Applied: ${company}`,
      }, env);
      await sendTelegram(chatId, `📋 *Job application logged*\n\nCompany: ${company}\n\nConsistency wins. Keep applying! 🎯`, env);
      return true;
    }

    case '/interview': {
      const co = args || 'company';
      await saveEvent({
        input_type: 'career', raw_text: text, topic: 'Interview',
        topics: ['career', 'interview'], energy_signal: 0.8, stress_signal: 0.5,
        focus_signal: 0.8, motivation_signal: 0.85, dominant_emotion: 'focused',
        career_type: 'interview', company: co, summary: `Interview: ${co}`,
      }, env);
      await sendTelegram(chatId, `🎯 *Interview logged*\n\n${co}\n\nYou got this! 💪`, env);
      return true;
    }

    case '/commands': {
      await sendTelegram(chatId,
        `*AETHER Life OS* 🤖\n\n` +
        `*📚 STUDY*\n/study [mins] [subject]\n/reflect [thoughts]\n\n` +
        `*💪 FITNESS*\n/exercise [mins] [type]\n/sleep [hours]\n/food [meal]\n/water [litres]\n/weight [kg]\n\n` +
        `*🧠 MENTAL*\n/mood [1-5]\n/grateful [what]\n/win [achievement]\n/negative [pattern]\n\n` +
        `*📵 PATTERNS*\n/distract [what]\n/procrastinate [task]\n\n` +
        `*🤝 LIFE*\n/social [who/what]\n/goal [text]\n/must [task]\n/done [num]\n\n` +
        `*💰 FINANCE*\n/spend [amount] [cat]\n/income [amount] [src]\n\n` +
        `*📊 INSIGHTS*\n/stats · /week · /streak · /flow · /morning · /evening`, env);
      return true;
    }

    default:
      return false;
  }
}

// ╔══════════════════════════════════════════════════════════════╗
// ║            AETHER OS — Cloudflare Worker v2.1               ║
// ║            api/worker.js                                    ║
// ╠══════════════════════════════════════════════════════════════╣
// ║  ROUTES                                                      ║
// ║  POST /webhook        ← Telegram messages (all types)       ║
// ║  POST /chat           ← Dashboard AI chat                   ║
// ║  POST /log-state      ← One-tap check-in widget             ║
// ║  GET  /dashboard      ← Latest dashboard.json for UI        ║
// ║  GET  /events         ← Raw events log (for ML pipeline)    ║
// ║  GET  /health         ← Status check                        ║
// ╚══════════════════════════════════════════════════════════════╝

const MAX_EVENTS = 500;
const MAX_HISTORY = 20;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
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

export default {

  async scheduled(event, env, ctx) {
    const hour = new Date().getUTCHours();
    const dayOfWeek = new Date().getUTCDay();
    if (hour === 3) ctx.waitUntil(sendMorningBriefing(env));
    if (hour === 15) ctx.waitUntil(sendEveningSummary(env));
    if (hour === 7) ctx.waitUntil(middayNudge(env));
    if (hour === 15 && dayOfWeek === 0) ctx.waitUntil(sendWeeklyReport(env));
  },

  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    console.log("PATH:", url.pathname);

    try {
      if (url.pathname === '/knowledge') {
        const data = await env.AETHER_KV.get("knowledge_graph");

        if (!data) {
          return new Response(JSON.stringify({
            nodes: [
              { id: "learning", type: "concept", mentions: 5 },
              { id: "coding", type: "activity", mentions: 8 },
              { id: "github", type: "tool", mentions: 6 }
            ]
          }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(data, {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.pathname === '/webhook' && request.method === 'POST') return handleWebhook(request, env);
      if (url.pathname === "/chat" && request.method === "POST") {
        console.log("✅ NEW JARVIS CORE HIT");

        const body = await request.json();
        const userMessage = body.message?.toLowerCase() || "";

        // 🔹 Get data FIRST
        const events = await getRecentEvents(env);
        const dashboard = await getDashboard(env);

        const analysis = analyzeState(events, dashboard);

        // 🔹 Pattern engine (AFTER events)
        const patterns = analyzePatterns(events);

        const patternText = `📊 Pattern Insight:\nBest hour: ${patterns.bestHour}:00\nTrend: ${patterns.trend}`;

        // 🔹 Helpers
        function energyLabel(e) {
          if (e > 0.7) return "high";
          if (e > 0.4) return "moderate";
          return "low";
        }

        function getTrend(events) {
          if (events.length < 5) return "stable";

          const recent = events.slice(-5).map(e => e.energy_signal || 0.5);
          const diff = recent[recent.length - 1] - recent[0];

          if (diff > 0.1) return "increasing";
          if (diff < -0.1) return "decreasing";
          return "stable";
        }

        const energyText = energyLabel(analysis.energy);
        const trend = getTrend(events);

        let response = "";

        // 🎯 INTENT HANDLING
        if (userMessage.includes("what should i do")) {
          response = analysis.advice;
        }
        else if (userMessage.includes("status")) {
          response = `🧠 JARVIS STATUS

      ⚡ Energy: ${energyText} (${analysis.energy.toFixed(2)})
      🔥 State: ${analysis.state}
      😤 Stress: ${analysis.stress.toFixed(2)}
      🎯 Focus: ${analysis.focus.toFixed(2)}
      📈 Trend: ${trend}`;
        }
        else {
          response = analysis.advice;
        }

        // 🔥 FINAL OUTPUT (NOW WITH PATTERNS)
        const finalResponse = `🧠 JARVIS CORE\n\n⚡ Energy: ${energyText}\n🔥 State: ${analysis.state.toUpperCase()}\n📈 Trend: ${trend}\n\n📌 ${response}\n\n${patternText}`;
        console.log("PATTERN:", patternText);
        return new Response(JSON.stringify({ reply: finalResponse }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.pathname === '/log-state' && request.method === 'POST') return handleLogState(request, env);
      if (url.pathname === '/dashboard' && request.method === 'GET') return handleDashboard(request, env);
      if (url.pathname === '/events' && request.method === 'GET') return handleEvents(request, env);
      if (url.pathname === '/update-dashboard' && request.method === 'POST') return handleUpdateDashboard(request, env);
      if (url.pathname === '/reset-data' && request.method === 'POST') return handleResetData(request, env);
      if (url.pathname === '/log-github' && request.method === 'POST') return handleGitHubLog(request, env);
      if (url.pathname === '/trigger' && request.method === 'POST') return handleTrigger(request, env);
      if (url.pathname === '/health' && request.method === 'GET') return handleHealth(request, env);
      if (url.pathname === '/priorities' && request.method === 'GET') return handleGetPriorities(request, env);
      if (url.pathname === '/priorities' && request.method === 'POST') return handleAddPriority(request, env);
      if (url.pathname === '/priorities/done' && request.method === 'POST') return handleDonePriority(request, env);
      if (url.pathname === '/tabs' && request.method === 'GET') {
        const tabs = await env.AETHER_KV.get("tabs:active", { type: "json" }) || [];
        return new Response(JSON.stringify({ tabs }), {
          headers: { "Content-Type": "application/json", 'Access-Control-Allow-Origin': '*' }
        });
      }
      if (url.pathname === '/knowledge' && request.method === 'GET') {
        const data = await env.AETHER_KV.get("knowledge_graph");

        if (!data) {
          return new Response(JSON.stringify({ nodes: [] }), {
            headers: { "Content-Type": "application/json" }
          });
        }

        return new Response(data, {
          headers: { "Content-Type": "application/json" }
        });
      }

      if (url.pathname === '/update-code-graph' && request.method === 'POST') {

        const graph = await request.json();

        await env.AETHER_KV.put(
          "code_graph",
          JSON.stringify(graph)
        );

        console.log("[AETHER] Code graph updated");

        return jsonResp({
          status: "code graph stored",
          nodes: graph.nodes ? graph.nodes.length : 0
        });
      }

      if (url.pathname === '/code' && request.method === 'GET') {

        const fn = url.searchParams.get("fn")

        const raw = await env.AETHER_KV.get("code_graph")

        if (!raw) {
          return jsonResp({ error: "code graph not loaded" })
        }

        const graph = JSON.parse(raw)

        const defined = graph.nodes
          .filter(n => n.name === fn)
          .map(n => n.file)

        const calls = graph.edges
          .filter(e => e.from === fn)
          .map(e => e.to)

        const used = graph.edges
          .filter(e => e.to === fn)
          .map(e => e.from)

        return jsonResp({
          function: fn,
          defined_in: defined,
          calls: [...new Set(calls)],
          used_in: [...new Set(used)]
        })
      }


      if (url.pathname === '/codepath' && request.method === 'GET') {

        const fn = url.searchParams.get("fn")

        const raw = await env.AETHER_KV.get("code_graph")

        if (!raw) {
          return jsonResp({ error: "code graph not loaded" })
        }

        const graph = JSON.parse(raw)

        function trace(target, visited = new Set()) {

          if (visited.has(target)) return []

          visited.add(target)

          const callers = graph.edges
            .filter(e => e.to === target)
            .map(e => e.from)

          if (callers.length === 0) {
            return [[target]]
          }

          let paths = []

          for (const caller of callers) {

            const subPaths = trace(caller, visited)

            for (const p of subPaths) {
              paths.push([...p, target])
            }

          }

          return paths
        }

        const paths = trace(fn)

        return jsonResp({
          function: fn,
          paths
        })
      }

      // ─── JOBS INTELLIGENCE ─────────────────────────────────────
      if (url.pathname === '/jobs/analyze' && request.method === 'POST') {
        const body = await request.json();
        const emailBody = body.email_body || '';

        if (!emailBody.trim()) {
          return jsonResp({ error: 'No email body provided' }, 400);
        }

        const profileSummary = `Cloud & DevOps Engineer, 3.6 years Azure at Accenture. Since Aug 2025: MLOps, ML pipelines, GitHub Actions, MLflow. Skills: Azure, AWS, Terraform, Docker, Python, CI/CD, Kubernetes. Targeting: DevOps / MLOps / Cloud Engineer roles in Pune/Remote. Expected CTC: 14-18 LPA.`;

        try {
          if (env.AI) {
            const aiResponse = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
              messages: [
                {
                  role: 'system',
                  content: `You are a job analysis assistant. Extract job details from emails and respond ONLY in valid JSON. No markdown, no extra text. Use this exact schema:
{"is_job_email":true,"company":"string","role":"string","location":"string","salary":"string","job_type":"string","fit_score":1-10,"fit_reason":"string","reply_email":"string"}

Profile to match against: ${profileSummary}

For fit_score: 8-10 = strong match (DevOps/MLOps/Cloud), 5-7 = partial match, 1-4 = poor match.
For reply_email: Write a brief, professional reply expressing interest if fit_score >= 6. Empty string if not.`
                },
                {
                  role: 'user',
                  content: `Analyze this email and extract job details:\n\n${emailBody.substring(0, 2000)}`
                }
              ],
              max_tokens: 600
            });

            const raw = (aiResponse.response || '').trim();
            // Try to parse JSON from the response
            let parsed;
            try {
              // Handle cases where AI wraps in markdown code blocks
              const jsonStr = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
              parsed = JSON.parse(jsonStr);
            } catch {
              // If JSON parsing fails, return basic extraction
              parsed = {
                is_job_email: true,
                company: 'Unknown',
                role: 'Unknown',
                location: 'Unknown',
                salary: 'Not mentioned',
                job_type: 'Unknown',
                fit_score: 5,
                fit_reason: 'AI could not fully parse this email',
                reply_email: ''
              };
            }

            return jsonResp(parsed);
          }

          // Fallback: no AI binding — basic regex extraction
          return jsonResp({
            is_job_email: true,
            company: 'Unknown (AI not available)',
            role: 'Unknown',
            location: 'Unknown',
            salary: 'Not mentioned',
            job_type: 'Unknown',
            fit_score: 5,
            fit_reason: 'Analyzed offline — AI binding not configured',
            reply_email: ''
          });

        } catch (err) {
          console.error('[AETHER] Job analysis error:', err);
          return jsonResp({ error: 'Analysis failed', detail: err.message }, 500);
        }
      }

      if (url.pathname.startsWith('/api')) {
        return jsonResp({ status: 'AETHER API ONLINE', version: '2.1' });
      }

      return env.ASSETS.fetch(request);

    } catch (err) {
      console.error('[AETHER] Unhandled error:', err);
      return jsonResp({ error: 'Internal server error', detail: err.message }, 500);
    }
  },
};

// ═════════════════════════════════════════════════════════════════
// 1. TELEGRAM WEBHOOK
// ═════════════════════════════════════════════════════════════════

async function handleWebhook(request, env) {
  let body;

  // 🔥 REAL-TIME JARVIS ALERTS

  try { body = await request.json(); }
  catch { return textResp('Bad JSON', 400); }

  const msg = body?.message || body?.edited_message;
  if (!msg) return textResp('No message', 200);

  const chatId = msg.chat?.id?.toString();
  const timestamp = new Date(msg.date * 1000).toISOString();

  if (env.TELEGRAM_CHAT_ID && chatId !== env.TELEGRAM_CHAT_ID.toString()) {
    console.warn('[AETHER] Rejected message from unknown chat:', chatId);
    return textResp('Unauthorized', 200);
  }

  let rawText = '';
  let inputType = 'text';
  let extra = {};

  if (msg.text) {
    if (msg.text.startsWith('/')) {
      const handled = await handleCommand(msg.text, chatId, env);
      if (handled) return textResp('OK', 200);
    }
    rawText = msg.text;
    inputType = 'text';
  }

  else if (msg.voice) {
    if (!env.AI) {
      await sendTelegram(chatId, '🎙 Voice noted! AI binding not configured yet.', env);
      return textResp('No AI binding', 200);
    }
    await sendTelegram(chatId, '🎙 Transcribing...', env);
    try {
      const fileUrl = await getTelegramFileUrl(msg.voice.file_id, env);
      rawText = await whisperTranscribe(fileUrl, env);
      inputType = 'voice';
      extra.duration_seconds = msg.voice.duration;
    } catch (e) {
      await sendTelegram(chatId, '⚠️ Could not transcribe: ' + e.message, env);
      return textResp('Voice error', 200);
    }
  }

  else if (msg.video_note) {
    if (!env.AI) {
      await sendTelegram(chatId, '🎥 Video noted! AI binding not configured yet.', env);
      return textResp('No AI binding', 200);
    }
    await sendTelegram(chatId, '🎥 Processing video...', env);
    try {
      const fileUrl = await getTelegramFileUrl(msg.video_note.file_id, env);
      rawText = await whisperTranscribe(fileUrl, env);
      inputType = 'video_note';
      extra.duration_seconds = msg.video_note.duration;
    } catch (e) {
      await sendTelegram(chatId, '⚠️ Could not process video: ' + e.message, env);
      return textResp('Video error', 200);
    }
  }

  else if (msg.photo) {
    await sendTelegram(chatId, '🖼 Reading image...', env);
    try {
      const bestPhoto = msg.photo[msg.photo.length - 1];
      const fileUrl = await getTelegramFileUrl(bestPhoto.file_id, env);
      rawText = await openaiVisionExtract(fileUrl, msg.caption || '', env);
      inputType = 'image';
    } catch (e) {
      await sendTelegram(chatId, '⚠️ Could not read image: ' + e.message, env);
      return textResp('Image error', 200);
    }
  }

  else if (msg.document) {
    const mime = msg.document.mime_type || '';
    if (mime === 'text/plain') {
      try {
        const fileUrl = await getTelegramFileUrl(msg.document.file_id, env);
        const resp = await fetch(fileUrl);
        rawText = await resp.text();
        inputType = 'document';
      } catch (e) {
        await sendTelegram(chatId, '⚠️ Could not read document: ' + e.message, env);
        return textResp('Doc error', 200);
      }
    } else {
      await sendTelegram(chatId, '📎 Only .txt documents are supported right now.', env);
      return textResp('Unsupported doc type', 200);
    }
  }

  else {
    return textResp('Unsupported message type', 200);
  }

  if (!rawText.trim()) {
    await sendTelegram(chatId, '🤔 Could not extract any text from that.', env);
    return textResp('Empty text', 200);
  }

  const parsed = await nlpParse(rawText, inputType, env);

  const hour = new Date(timestamp).getUTCHours();
  const dayOfWeek = new Date(timestamp).getUTCDay();
  const wordCount = rawText.trim().split(/\s+/).length;
  const complexity = Math.min(1, wordCount / 50);
  const questionCount = (rawText.match(/\?/g) || []).length;
  const questionRatio = Math.min(1, questionCount / Math.max(1, wordCount / 10));
  const exclamations = (rawText.match(/!/g) || []).length;

  const event = {
    timestamp,
    input_type: inputType,
    raw_text: rawText.slice(0, 500),
    hour_utc: hour,
    hour_sin: Math.sin(2 * Math.PI * hour / 24),
    hour_cos: Math.cos(2 * Math.PI * hour / 24),
    day_of_week: dayOfWeek,
    is_weekend: dayOfWeek === 0 || dayOfWeek === 6,
    word_count: wordCount,
    complexity: Math.round(complexity * 100) / 100,
    question_ratio: Math.round(questionRatio * 100) / 100,
    exclamation_count: exclamations,
    message_length: rawText.length,
    ...parsed,
    ...extra,
  };
  await saveEvent(event, env);

  // Dual-write to Supabase for ML pipeline
fetch(`${env.SUPABASE_URL}/rest/v1/events`, {
  method: 'POST',
  headers: {
    'apikey': env.SUPABASE_KEY,
    'Authorization': `Bearer ${env.SUPABASE_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
  },
  body: JSON.stringify({
    user_id:            'avi',
    input_text:         event.raw_text || '',
    raw_text:           event.raw_text || '',
    source:             event.input_type || 'telegram',
    input_type:         event.input_type || 'text',
    topic:              event.topic || null,
    life_dimension:     event.life_dimension || 'general',
    energy_signal:      event.energy_signal || 0.5,
    stress_signal:      event.stress_signal || 0.2,
    focus_signal:       event.focus_signal || 0.5,
    motivation_signal:  event.motivation_signal || 0.5,
    stat_impact:        event.stat_impact || {},
    sentiment:          event.sentiment || 'neutral',
    dominant_emotion:   event.dominant_emotion || 'neutral',
    is_win:             !!event.is_win,
    is_procrastination: !!event.is_procrastination,
    is_distraction:     !!event.is_distraction,
    is_negative_self:   !!event.is_negative_self,
    is_study_session:   !!event.is_study_session,
    is_goal_mention:    !!event.is_goal_mention,
    estimated_minutes:  event.estimated_minutes || null,
    summary:            event.summary || null,
    word_count:         event.word_count || null,
    hour_utc:           event.hour_utc || null,
    day_of_week:        event.day_of_week || null,
    created_at:         event.timestamp,
  })
}).catch(e => console.warn('[AETHER] Supabase write failed:', e.message));

  // 🔥 JARVIS INTELLIGENCE
  const events = await getRecentEvents(env);

  const decision = floatingBrain(events);
  if (decision) {
    await updateTabs(env, decision);
  }

  const dashboard = await getDashboard(env);
  const analysis = analyzeState(events, dashboard);

  // 🔥 REAL-TIME JARVIS ALERTS (FIXED POSITION)

  const lastAlert = await env.AETHER_KV.get("last_alert");

  // 🚀 FLOW
  if (analysis.state === "flow_ready") {
    await sendJarvisAlert(
      env,
      chatId,
      "flow",
      "🚀 FLOW DETECTED — Start deep work NOW"
    );
  }

  // ⚠️ LOW FOCUS
  if (analysis.state === "low_focus") {
    await sendJarvisAlert(
      env,
      chatId,
      "focus",
      "⚠️ Focus dropping — take 5 min reset"
    );
  }

  // 🧠 BURNOUT
  if (analysis.state === "burnout") {
    await sendJarvisAlert(
      env,
      chatId,
      "burnout",
      "🧠 Burnout detected — stop and rest"
    );
  }

  if (analysis.state === "moderate") {
    await env.AETHER_KV.put("last_alert", "none");
  }

  // original logging reply
  const baseReply = buildTelegramReply(parsed, inputType, rawText);

  const jarvisReply = `🧠 *JARVIS*\n⚡ Energy: ${analysis.energy.toFixed(2)}\n🔥 State: ${analysis.state.toUpperCase()}\n\n${analysis.advice}`;
  await sendTelegram(chatId, baseReply + '\n\n' + jarvisReply, env);

  return textResp('OK', 200);
}

// ═════════════════════════════════════════════════════════════════
// 2. CHAT ENDPOINT — ENGINE SWITCHER
//    engine = "ml"     → runAetherML()  (live signals from events)
//    engine = "worker" → runWorkersAI() (pure Llama-3)
//    engine = "hybrid" → runHybrid()    (ML context + Llama-3)
// ═════════════════════════════════════════════════════════════════

async function handleChat(request, env) {
  let body;
  try { body = await request.json(); }
  catch { return jsonResp({ error: 'Bad JSON' }, 400); }

  const {
    history = [],
    metrics = {},
    activity = [],
    goals = [],
    engine = 'hybrid',
  } = body;

  const recentEvents = await getRecentEvents(10, env);
  const latestState = await getLatestState(env);
  const systemPrompt = buildSystemPrompt(metrics, activity, goals, recentEvents, latestState);
  const trimmedHistory = history.slice(-MAX_HISTORY);

  let reply;
  try {
    if (engine === 'ml') reply = await runAetherML(env);
    else if (engine === 'worker') reply = await runWorkersAI(systemPrompt, trimmedHistory, env);
    else reply = await runHybrid(systemPrompt, trimmedHistory, env);
  } catch (e) {
    console.error('[AETHER] Chat engine error:', e);
    return jsonResp({ error: 'AI unavailable: ' + e.message }, 500);
  }

  return jsonResp({ reply });
}


async function handleGetPriorities(request, env) {
  const priorities = await env.AETHER_KV.get('priorities:list', { type: 'json' }) || [];
  return new Response(JSON.stringify(priorities), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function handleAddPriority(request, env) {
  const { text } = await request.json();
  if (!text?.trim()) return new Response(JSON.stringify({ error: 'No text' }), { status: 400 });
  const priorities = await env.AETHER_KV.get('priorities:list', { type: 'json' }) || [];
  const item = { id: Date.now(), text: text.trim(), done: false, created: new Date().toISOString() };
  priorities.unshift(item);
  await env.AETHER_KV.put('priorities:list', JSON.stringify(priorities));
  return new Response(JSON.stringify({ ok: true, item }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

async function handleDonePriority(request, env) {
  const { id } = await request.json();
  const priorities = await env.AETHER_KV.get('priorities:list', { type: 'json' }) || [];
  const item = priorities.find(p => p.id === id);
  if (item) { item.done = true; item.completedAt = new Date().toISOString(); }
  await env.AETHER_KV.put('priorities:list', JSON.stringify(priorities));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}

// ═════════════════════════════════════════════════════════════════
// 3. LOG STATE
// ═════════════════════════════════════════════════════════════════

async function handleLogState(request, env) {
  let stateVector;
  try { stateVector = await request.json(); }
  catch { return jsonResp({ error: 'Bad JSON' }, 400); }

  if (!stateVector.state_label || stateVector.energy === undefined) {
    return jsonResp({ error: 'Missing required fields: state_label, energy' }, 400);
  }

  stateVector.server_timestamp = new Date().toISOString();

  const today = new Date().toISOString().split('T')[0];
  await env.AETHER_KV.put(`state:${today}`, JSON.stringify(stateVector));

  const event = {
    timestamp: stateVector.server_timestamp,
    input_type: 'checkin',
    state_label: stateVector.state_label,
    energy: stateVector.energy,
    stress: stateVector.stress,
    mood: stateVector.mood,
    flow_prob: stateVector.flow_prob,
    flow_class: stateVector.flow_class,
    goal: stateVector.goal,
    mods: (stateVector.mods || []).join(','),
  };
  await saveEvent(event, env);
  await refreshDashboardFromState(stateVector, env);

  console.log('[AETHER] State logged:', stateVector.state_label, '| energy:', stateVector.energy);
  return jsonResp({ ok: true, message: 'State synced to AETHER' });
}

// ═════════════════════════════════════════════════════════════════
// 4. DASHBOARD ENDPOINT
// ═════════════════════════════════════════════════════════════════

async function handleDashboard(request, env) {
  try {
    const events = await getRecentEvents(200, env);
    const latestState = await getLatestState(env);
    const today = new Date().toISOString().split('T')[0];
    const todayEv = events.filter(e => e.timestamp?.startsWith(today));
    const todayGoal = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);
    const streak = await calculateStreak(events);

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
    const hoursToday = Math.round(studySessions * 0.5 * 10) / 10;

    let flowProb = 0;
    if (latestState?.flow_prob) flowProb = Math.round(latestState.flow_prob * 100);
    else if (avgEnergy > 75 && avgStress < 25) flowProb = 85;
    else if (avgEnergy > 55 && avgStress < 45) flowProb = 55;
    else flowProb = 20;

    const topicCounts = {};
    todayEv.forEach(e => {
      if (e.topic && e.topic !== 'general') {
        topicCounts[e.topic] = (topicCounts[e.topic] || 0) + 1;
      }
    });
    const activity = Object.entries(topicCounts)
      .sort((a, b) => b[1] - a[1]).slice(0, 5)
      .map(([topic, count]) => ({ topic, minutes: count * 25, cat: 'LOGGED' }));

    const timeline = todayEv.slice(0, 8).map(e => ({
      time: new Date(e.timestamp).toLocaleTimeString('en-IN', {
        hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata',
      }),
      event: `${e.input_type}: ${e.summary || e.topic || 'logged'}`,
    }));

    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      const dayEv = events.filter(e => e.timestamp?.startsWith(ds));
      const dayEnergy = dayEv.length > 0
        ? dayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / dayEv.length : 0;
      weekData.push(Math.round(dayEnergy * 10) / 10);
    }

    const insights = generateInsights(events, todayEv, avgEnergy, avgStress, streak);

    const goals = {
      today: todayGoal ? [{ text: todayGoal, done: false, cat: 'TODAY' }] : [],
      week: [],
    };

    const inputCounts = {};
    events.forEach(e => {
      const t = e.input_type || 'text';
      inputCounts[t] = (inputCounts[t] || 0) + 1;
    });

    const hourlyData = new Array(24).fill(0);
    events.forEach(e => {
      if (e.timestamp) {
        const h = new Date(e.timestamp).getUTCHours();
        hourlyData[h] = (hourlyData[h] || 0) + 1;
      }
    });

    let flowLabel = 'NOMINAL';
    if (latestState?.flow_class) flowLabel = latestState.flow_class;
    else if (avgEnergy > 75 && avgStress < 25) flowLabel = 'FLOW';
    else if (avgEnergy > 60 && avgStress < 35) flowLabel = 'PRE-FLOW';
    else if (avgStress > 60) flowLabel = 'ANXIETY';
    else if (avgEnergy < 35) flowLabel = 'RECOVERY';

    const dash = {
      metrics: {
        focus: avgFocus || avgEnergy,
        learning: Math.round(avgEnergy * 0.9),
        productivity: flowProb,
        mood: Math.round((1 - avgStress / 100) * 100),
        streak,
        hours_today: hoursToday,
        tasks_done: todayEv.filter(e => e.is_goal_mention).length,
        total_events: events.length,
        last_updated: new Date().toISOString(),
      },
      state: latestState,
      activity: activity.length > 0 ? activity : defaultDashboard().activity,
      timeline: timeline.length > 0 ? timeline : defaultDashboard().timeline,
      weekData,
      insights,
      goals,
      streak,
      inputCounts,
      hourlyData,
      todayCount: todayEv.length,
      flowLabel,
      pipeline: [
        { icon: '📥', name: 'pull_events.py', sub: 'KV → events.csv', status: 'OK', cls: 'ps-ok' },
        { icon: '🧹', name: 'data_cleaner.py', sub: 'Remove bad events', status: 'OK', cls: 'ps-ok' },
        { icon: '🏋', name: 'train_models.py', sub: 'RandomForest + GBM', status: events.length >= 10 ? 'TRAINED' : 'WAITING', cls: events.length >= 10 ? 'ps-ok' : 'ps-warn' },
        { icon: '🔮', name: 'predict.py', sub: 'Flow + peak hour', status: events.length >= 10 ? 'OK' : 'WAITING', cls: events.length >= 10 ? 'ps-ok' : 'ps-warn' },
        { icon: '📤', name: 'push_dashboard.py', sub: 'Predictions → KV', status: 'OK', cls: 'ps-ok' },
      ],
    };

    // ── Life Stats (Solo Leveling) ──────────────────────────────
    const dimScores = { study:0, fitness:0, mental:0, social:0, finance:0, career:0, sleep:0 };
    const dimCounts = { ...dimScores };
    const negatives = { procrastination:0, distraction:0, negative_self:0 };
    const wins = [];
    const statTotals = { INT:0, STR:0, VIT:0, AGI:0, SEN:0 };

    events.forEach(e => {
      const d = e.life_dimension;
      if (d && dimScores[d] !== undefined) {
        dimScores[d] += (e.energy_signal||0.5) * (e.focus_signal||0.5);
        dimCounts[d]++;
      }
      if (e.is_procrastination) negatives.procrastination++;
      if (e.is_distraction)     negatives.distraction++;
      if (e.is_negative_self)   negatives.negative_self++;
      if (e.is_win && e.summary) wins.push({ text: e.summary, ts: e.timestamp });
      if (e.stat_impact && typeof e.stat_impact === 'object') {
        Object.entries(e.stat_impact).forEach(([k,v]) => { if (statTotals[k]!==undefined) statTotals[k] += (v||0); });
      }
    });

    const maxStat = Math.max(...Object.values(statTotals), 1);
    const soloStats = Object.fromEntries(
      Object.entries(statTotals).map(([k,v]) => [k, Math.min(100, Math.round(v/maxStat*100))])
    );
    const level = Math.max(1, Math.floor(Object.values(soloStats).reduce((s,v)=>s+v,0)/50));

    dash.lifeStats = {
      dimensions: Object.fromEntries(
        Object.entries(dimScores).map(([d,s]) => [d, dimCounts[d]>0 ? Math.round(s/dimCounts[d]*100) : 0])
      ),
      soloStats,
      level,
      negatives,
      recentWins: wins.slice(-5).reverse(),
      topNegative: Object.entries(negatives).sort((a,b)=>b[1]-a[1])[0]?.[0] || null,
    };

    return new Response(JSON.stringify(dash, null, 2), {
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS },
    });

  } catch (e) {
    console.warn('[AETHER] Dashboard compute failed:', e.message);
    return jsonResp(defaultDashboard());
  }
}

function generateInsights(events, todayEv, avgEnergy, avgStress, streak) {
  const insights = [];

  const hourEnergy = {};
  events.forEach(e => {
    const h = new Date(e.timestamp).getUTCHours();
    if (!hourEnergy[h]) hourEnergy[h] = [];
    hourEnergy[h].push(e.energy_signal || 0.5);
  });
  const peakHour = Object.entries(hourEnergy)
    .map(([h, vals]) => ({ h: parseInt(h), avg: vals.reduce((s, v) => s + v, 0) / vals.length }))
    .sort((a, b) => b.avg - a.avg)[0];

  if (peakHour) {
    const istHour = (peakHour.h + 5) % 24;
    const ampm = istHour >= 12 ? 'pm' : 'am';
    const h12 = istHour % 12 || 12;
    insights.push({
      icon: '⚡', title: 'Peak Performance Window',
      body: `Your energy peaks around ${h12}${ampm} IST based on ${events.length} logged events. Schedule your hardest tasks then.`,
      tag: 'PATTERN', tagClass: 'tag-ok',
    });
  }

  if (avgStress > 60) {
    insights.push({
      icon: '⚠️', title: 'High Stress Detected',
      body: 'Your stress signals are elevated today. Break tasks into smaller steps and take short breaks.',
      tag: 'WARNING', tagClass: 'tag-med',
    });
  } else if (avgEnergy > 70) {
    insights.push({
      icon: '🔥', title: 'High Energy Day',
      body: `Energy at ${avgEnergy}% — good conditions for deep work. Protect this window.`,
      tag: 'POSITIVE', tagClass: 'tag-ok',
    });
  }

  if (streak >= 3) {
    insights.push({
      icon: '🔥', title: `${streak}-Day Streak`,
      body: `You have logged data for ${streak} consecutive days. AETHER is building your behavioral model.`,
      tag: streak >= 7 ? 'HIGH PRIORITY' : 'POSITIVE',
      tagClass: streak >= 7 ? 'tag-hi' : 'tag-ok',
    });
  }

  if (todayEv.length === 0) {
    insights.push({
      icon: '💡', title: 'No Data Today Yet',
      body: 'Send a message to your Telegram bot to start logging today activity.',
      tag: 'ACTION', tagClass: 'tag-med',
    });
  }

  return insights.slice(0, 3);
}

// ═════════════════════════════════════════════════════════════════
// 5. EVENTS ENDPOINT
// ═════════════════════════════════════════════════════════════════

async function handleEvents(request, env) {
  try {
    let events = await env.AETHER_KV.get("events:list", { type: "json" });

    // ✅ FIX: handle null safely
    if (!events || !Array.isArray(events)) {
      events = [];
    }

    return new Response(JSON.stringify({
      events: events.slice(-50)
    }), {
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*"
      }
    });

  } catch (err) {
    console.log("EVENTS ERROR:", err);

    return new Response(JSON.stringify({
      error: "Failed to load events",
      details: err.message
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

// ═════════════════════════════════════════════════════════════════
// 6. HEALTH CHECK
// ═════════════════════════════════════════════════════════════════

async function handleHealth(request, env) {
  const kvOk = !!env.AETHER_KV;
  const openaiOk = !!env.OPENAI_API_KEY;
  const telegramOk = !!env.TELEGRAM_BOT_TOKEN;
  const chatIdOk = !!env.TELEGRAM_CHAT_ID;
  const eventCount = await getEventCount(env);
  const coreReady = kvOk && !!env.AI && telegramOk && chatIdOk;

  return jsonResp({
    status: coreReady ? 'AETHER ONLINE ✅' : 'AETHER PARTIAL ⚠️',
    version: '2.1',
    timestamp: new Date().toISOString(),
    services: {
      kv: kvOk ? 'OK' : '❌ MISSING',
      cf_ai: env.AI ? 'OK' : '❌ MISSING — add [ai] to wrangler.toml',
      telegram_token: telegramOk ? 'OK' : '❌ MISSING',
      telegram_chat_id: chatIdOk ? 'OK' : '❌ MISSING',
      openai: openaiOk ? 'OK' : '⚪ OPTIONAL',
    },
    data: { total_events: eventCount },
  });
}

// ═════════════════════════════════════════════════════════════════
// AUTOMATION ENGINE
// ═════════════════════════════════════════════════════════════════

async function handleTrigger(request, env) {
  try {
    const body = await request.json();
    const action = body.action;
    const data = body.data || {};

    console.log('[AETHER] Trigger:', action);

    switch (action) {

      case 'smart_nudge': {
        const state = await getLatestState(env);
        const events = await getRecentEvents(env, 5);
        const avgE = events.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / Math.max(events.length, 1);
        let msg;
        if (!state && events.length === 0) msg = '👋 AETHER here. No data logged today yet. What are you working on?';
        else if (avgE > 0.75) msg = `⚡ You're in high energy mode. What's the hardest thing on your list right now?`;
        else if (avgE < 0.35) msg = `😴 Low energy detected. Small task or rest? Reply to log your state.`;
        else msg = `🎯 Mid-day check: still on track with your goal? Reply to update AETHER.`;
        await sendTelegram(env.TELEGRAM_CHAT_ID, msg, env);
        return jsonResp({ ok: true, action, sent: msg });
      }

      case 'notion_log': {
        if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
          return jsonResp({ ok: false, error: 'NOTION_TOKEN and NOTION_DATABASE_ID not set' });
        }
        const events = await getRecentEvents(20, env);
        const today = new Date().toISOString().split('T')[0];
        const todayEv = events.filter(e => e.timestamp?.startsWith(today));
        const avgE = todayEv.length > 0
          ? Math.round(todayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / todayEv.length * 100) : 0;
        const topics = [...new Set(todayEv.map(e => e.topic).filter(Boolean))].slice(0, 5).join(', ');
        const resp = await fetch('https://api.notion.com/v1/pages', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${env.NOTION_TOKEN}`,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            parent: { database_id: env.NOTION_DATABASE_ID },
            properties: {
              'Name': { title: [{ text: { content: `AETHER Log — ${today}` } }] },
              'Date': { date: { start: today } },
              'Energy': { number: avgE },
              'Events': { number: todayEv.length },
              'Topics': { rich_text: [{ text: { content: topics } }] },
            },
          }),
        });
        const notionData = await resp.json();
        return jsonResp({ ok: resp.ok, notion_id: notionData.id });
      }

      case 'webhook': {
        if (!data.url) return jsonResp({ error: 'data.url required' }, 400);
        const state = await getLatestState(env);
        const events = await getRecentEvents(5, env);
        const payload = {
          timestamp: new Date().toISOString(),
          state,
          recent_events: events.slice(0, 3),
          ...data.extra,
        };
        const resp = await fetch(data.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        return jsonResp({ ok: resp.ok, status: resp.status });
      }

      case 'spotify_flow': {
        const playlistUrl = env.SPOTIFY_FLOW_PLAYLIST || 'https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS';
        await sendTelegram(env.TELEGRAM_CHAT_ID,
          `🎵 *Flow playlist*\nYou entered flow state — time to focus.\n${playlistUrl}`, env);
        return jsonResp({ ok: true, action, playlist: playlistUrl });
      }

      case 'checkin_reminder': {
        const url = 'https://learning-bot.pages.dev/checkin.html';
        await sendTelegram(env.TELEGRAM_CHAT_ID,
          `📊 *Quick check-in*\nHow are you right now?\n${url}`, env);
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
    const now = new Date().toISOString();
    const event = {
      timestamp: now,
      input_type: 'github',
      raw_text: `git push: ${body.commit_message}`,
      topic: body.topic || 'Coding',
      topics: ['coding', 'github', body.repo?.split('/')[1] || 'project'],
      sentiment: 'positive',
      energy_signal: parseFloat(body.energy_signal) || 0.7,
      stress_signal: 0.15,
      focus_signal: 0.8,
      motivation_signal: 0.75,
      dominant_emotion: 'neutral',
      is_study_session: true,
      is_goal_mention: body.commit_message?.toLowerCase().includes('feat') || false,
      is_complaint: false,
      estimated_minutes: Math.min(120, (body.files_changed || 1) * 15),
      summary: `GitHub push: ${body.commit_message?.slice(0, 80)}`,
      github_repo: body.repo,
      github_branch: body.branch,
      files_changed: body.files_changed || 0,
      lines_added: body.additions || 0,
      lines_deleted: body.deletions || 0,
      hour_utc: new Date().getUTCHours(),
      hour_sin: Math.sin(2 * Math.PI * new Date().getUTCHours() / 24),
      hour_cos: Math.cos(2 * Math.PI * new Date().getUTCHours() / 24),
      day_of_week: new Date().getUTCDay(),
      is_weekend: [0, 6].includes(new Date().getUTCDay()),
    };
    await saveEvent(event, env);
    if ((body.files_changed || 0) >= 5 && env.TELEGRAM_CHAT_ID) {
      await sendTelegram(env.TELEGRAM_CHAT_ID,
        `⚡ *Code logged*\n${body.commit_message?.slice(0, 60)}\n${body.files_changed} files · +${body.additions || 0} −${body.deletions || 0}`, env);
    }
    console.log('[AETHER] GitHub push logged:', body.commit_message?.slice(0, 50));
    return jsonResp({ ok: true, message: 'GitHub activity logged to AETHER' });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}

async function handleResetData(request, env) {
  try {
    const body = await request.json();
    if (body.confirm !== 'RESET_ALL_EVENTS') {
      return jsonResp({ error: 'Confirmation required: send confirm: RESET_ALL_EVENTS' }, 400);
    }
    await env.AETHER_KV.put('events:list', JSON.stringify([]));
    await env.AETHER_KV.put('events:count', '0');
    await env.AETHER_KV.put('dashboard:latest', JSON.stringify({
      metrics: { focus: 0, learning: 0, productivity: 0, mood: 0, last_updated: new Date().toISOString() },
      state: null, activity: [], timeline: [], weekData: [0, 0, 0, 0, 0, 0, 0],
      insights: [{ icon: '🌱', title: 'Fresh start', body: 'Clean data logging begins now.', tag: 'RESET', tagClass: 'tag-ok' }],
      goals: { today: [], week: [] }, streak: 0,
    }));
    console.log('[AETHER] Data reset completed');
    return jsonResp({ ok: true, message: 'All events cleared. Fresh start ready.' });
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

// ═════════════════════════════════════════════════════════════════
// NLP PARSER
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
    if (!env.AI) throw new Error('No AI binding');
    const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
    });
    const raw = result?.response || '{}';
    let parsed = null;
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) { try { parsed = JSON.parse(match[0]); } catch { } }
    if (!parsed || typeof parsed.energy_signal !== 'number') {
      console.warn('[AETHER] Llama JSON invalid, using fallback');
      return fallbackNLP(text);
    }
    return parsed;
  } catch (e) {
    console.warn('[AETHER] NLP parse failed, using fallback:', e.message);
    return fallbackNLP(text);
  }
}

function fallbackNLP(text) {
  const lower = text.toLowerCase();
  const energyWords = ['excited', 'great', 'amazing', 'productive', 'focused', 'motivated', 'energy'];
  const stressWords = ['stressed', 'tired', 'overwhelmed', 'anxious', 'worried', 'stuck', 'confused'];
  const studyWords = ['learned', 'studied', 'reading', 'course', 'practice', 'revision', 'chapter'];
  const energyScore = energyWords.filter(w => lower.includes(w)).length / energyWords.length;
  const stressScore = stressWords.filter(w => lower.includes(w)).length / stressWords.length;
  const isStudy = studyWords.some(w => lower.includes(w));
  return {
    topic: 'general', topics: [],
    sentiment: stressScore > 0.2 ? 'negative' : energyScore > 0.2 ? 'positive' : 'neutral',
    energy_signal: Math.min(1, 0.5 + energyScore - stressScore),
    stress_signal: Math.min(1, stressScore * 2),
    focus_signal: 0.5, motivation_signal: 0.5, dominant_emotion: 'neutral',
    is_study_session: isStudy,
    is_goal_mention: lower.includes('goal') || lower.includes('target') || lower.includes('plan'),
    is_complaint: stressScore > 0.3,
    estimated_minutes: null, summary: text.slice(0, 80),
  };
}

// ═════════════════════════════════════════════════════════════════
// VISION
// ═════════════════════════════════════════════════════════════════

async function openaiVisionExtract(imageUrl, caption, env) {
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) throw new Error('Could not download image');
  const imgArray = [...new Uint8Array(await imgResp.arrayBuffer())];
  if (!env.AI) throw new Error('AI binding missing — add [ai] to wrangler.toml');
  const prompt = caption
    ? `Image caption: "${caption}". Describe what you see in this image in English. Extract any visible text, topics, tasks or key information.`
    : 'Describe what you see in this image in English only. List any visible text, objects, activities, or key information.';
  const result = await env.AI.run('@cf/llava-hf/llava-1.5-7b-hf', { image: imgArray, prompt, max_tokens: 512 });
  if (!result?.description) throw new Error('Vision model returned empty result');
  return result.description;
}

// ═════════════════════════════════════════════════════════════════
// WHISPER
// ═════════════════════════════════════════════════════════════════

async function whisperTranscribe(audioUrl, env) {
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error('Could not download audio file');
  const audioBuffer = await audioResponse.arrayBuffer();
  if (!env.AI) throw new Error('AI binding missing — add [ai] to wrangler.toml');
  if (audioBuffer.byteLength > 25 * 1024 * 1024) throw new Error('Audio file too large (max 25MB).');
  const result = await env.AI.run('@cf/openai/whisper', { audio: [...new Uint8Array(audioBuffer)] });
  const transcript = result?.text || result?.transcription || '';
  if (!transcript.trim()) throw new Error('Could not transcribe — try speaking more clearly.');
  return transcript.trim();
}



// ═══════════════════════════════════════════
// ML PIPELINE TRIGGER
// ═══════════════════════════════════════════

async function triggerMLPipeline(env) {
  if (!env.GITHUB_TOKEN) {
    console.warn("[AETHER] No GitHub token configured");
    return;
  }

  console.log("[AETHER] Triggering ML pipeline...");

  const resp = await fetch(
    "https://api.github.com/repos/talpadeavi03/learning-bot/dispatches",
    {
      method: "POST",
      headers: {
        Authorization: `token ${env.GITHUB_TOKEN}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "User-Agent": "aether-worker"
      },
      body: JSON.stringify({
        event_type: "telegram_batch",
      }),
    }
  );

  const text = await resp.text();

  console.log("[AETHER] GitHub status:", resp.status);
  console.log("[AETHER] GitHub body:", text);
}


// ═════════════════════════════════════════════════════════════════
// TELEGRAM HELPERS
// ═════════════════════════════════════════════════════════════════

async function getTelegramFileUrl(fileId, env) {
  const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const data = await resp.json();
  if (!data.ok) throw new Error('Telegram getFile failed: ' + JSON.stringify(data));
  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}

// 🔽 ADD HERE (helper section)

async function shouldSendUpdate(env, currentState) {
  const lastState = await env.AETHER_KV.get("last_state");

  if (lastState === currentState) return false;

  await env.AETHER_KV.put("last_state", currentState);
  return true;
}

async function checkCooldown(env, seconds = 300) {
  const lastTime = await env.AETHER_KV.get("last_sent_time");
  const now = Date.now();

  if (lastTime && now - Number(lastTime) < seconds * 1000) {
    return false;
  }

  await env.AETHER_KV.put("last_sent_time", now.toString());
  return true;
}

async function sendTelegram(chatId, text, env) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.warn('[AETHER] sendTelegram failed:', e.message);
  }
}

function buildTelegramReply(parsed, inputType, rawText) {
  const icons = { text: '📝', voice: '🎙', video_note: '🎥', image: '🖼', document: '📄', goal: '🎯', mood: '😊', checkin: '✅' };
  const icon = icons[inputType] || '📨';
  const energy = Math.round((parsed.energy_signal || 0.5) * 100);
  const stress = Math.round((parsed.stress_signal || 0.2) * 100);
  const focus = Math.round((parsed.focus_signal || 0.5) * 100);
  const sentiment = parsed.sentiment || 'neutral';
  const topic = parsed.topic || 'general';
  const summary = parsed.summary || rawText.slice(0, 80);

  let flowLabel;
  if (energy > 80 && stress < 20) flowLabel = '🟢 FLOW ZONE';
  else if (energy > 60 && stress < 40) flowLabel = '🟡 PRE-FLOW';
  else if (stress > 65) flowLabel = '🔴 HIGH STRESS';
  else if (energy < 25) flowLabel = '⚫ LOW ENERGY';
  else flowLabel = '⚪ NOMINAL';

  const moodEmoji = sentiment === 'positive' ? '😊' : sentiment === 'negative' ? '😔' : '😐';

  if (inputType === 'image') {
    return `🖼 *Image logged*\n\nSeen: ${summary}\nTopic: ${topic}\n\n⚡ ${energy}%  😤 ${stress}%  🎯 ${focus}%  ${flowLabel}`;
  }
  if (inputType === 'voice' || inputType === 'video_note') {
    return `🎙 *Voice logged*\n\n"_${summary}_"\n\nTopic: ${topic}  ${moodEmoji} ${sentiment}\n⚡ ${energy}%  😤 ${stress}%  🎯 ${focus}%\n${flowLabel}`;
  }
  return `${icon} *Logged* · ${topic}\n${moodEmoji} ${sentiment}  ⚡ ${energy}%  😤 ${stress}%  🎯 ${focus}%\n${flowLabel}\n_${summary.slice(0, 100)}_`;
}

// ═════════════════════════════════════════════════════════════════
// SYSTEM PROMPT
// ═════════════════════════════════════════════════════════════════

function buildSystemPrompt(metrics, activity, goals, recentEvents, latestState) {
  const stateContext = latestState
    ? `\nUser's current state: ${latestState.state_label}, energy: ${latestState.energy}, stress: ${latestState.stress}, flow: ${latestState.flow_class}`
    : '';

  const eventsContext = recentEvents.length > 0
    ? `\nRecent activity (last ${recentEvents.length} events):\n` +
    recentEvents.map(e =>
      `- [${e.timestamp?.split('T')[0]}] ${e.input_type}: ${e.topic || e.summary || 'logged'} | energy:${((e.energy_signal || 0.5) * 100).toFixed(0)}%`
    ).join('\n')
    : '';

  const todayActivity = activity.map(a => a.topic + '(' + a.minutes + 'm)').join(', ') || 'none';
  const todayGoals = goals.map(g => g.text || g).join(', ') || 'none';

  return `You are AETHER — Avi personal AI OS. Respond like a sharp coach, not a chatbot.

LIVE DATA: Focus:${metrics.focus || 0}% Energy:${metrics.learning || 0}% Productivity:${metrics.productivity || 0}% Mood:${metrics.mood || 0}%
${stateContext}${eventsContext}
Goals: ${todayGoals} | Activity: ${todayActivity}

STRICT RULES:
1. Max 2-3 sentences. Never longer.
2. No greetings, no preamble. Start with the answer.
3. Use actual numbers from the data above when relevant.
4. End with ONE specific action if asked about focus/goals/productivity.
5. If stressed or low energy detected: one sentence acknowledgment then solution.
6. Be direct, occasionally blunt. You know Avi well.`;
}

// ── Legacy wrapper (kept for safety, no longer called by handleChat) ──
async function callOpenAI(systemPrompt, history, env) {
  if (!env.AI) throw new Error('AI binding missing');
  const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [{ role: 'system', content: systemPrompt }, ...history],
    max_tokens: 400,
  });
  return result?.response || 'No response from AI.';
}

// ═════════════════════════════════════════════════════════════════
// ENGINE: AETHER ML
// Reads live from events — no AI call, instant, always accurate
// ═════════════════════════════════════════════════════════════════

async function runAetherML(env) {
  const events = await getRecentEvents(20, env);
  const today = new Date().toISOString().split('T')[0];
  const todayEv = events.filter(e => e.timestamp?.startsWith(today));

  // Use today's events if available, else fall back to last 10 events
  const allEv = todayEv.length > 0 ? todayEv : events.slice(0, 10);

  if (allEv.length === 0) {
    return `[ML]\nNo data yet. Send messages to your Telegram bot to train AETHER.\n\nFocus: 0%  Energy: 0%  Productivity: 0%  Mood: 0%`;
  }

  const focus = Math.round(allEv.reduce((s, e) => s + (e.focus_signal || 0.5), 0) / allEv.length * 100);
  const energy = Math.round(allEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / allEv.length * 100);
  const stress = Math.round(allEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / allEv.length * 100);
  const motivation = Math.round(allEv.reduce((s, e) => s + (e.motivation_signal || 0.5), 0) / allEv.length * 100);

  // Derived scores
  const productivity = stress < 40 && energy > 60
    ? Math.round((energy + focus) / 2)
    : Math.round(energy * 0.7);
  const mood = Math.round((100 - stress) * 0.7 + motivation * 0.3);

  // Flow label
  const latestState = await getLatestState(env);
  const flowLabel = latestState?.flow_class ||
    (energy > 75 && stress < 25 ? 'FLOW' :
      energy > 60 && stress < 40 ? 'PRE-FLOW' :
        stress > 60 ? 'ANXIETY' : 'NOMINAL');

  // Insights
  const insights = [];
  if (focus > 70) insights.push('Focus is strong — good time for deep work.');
  else if (focus < 40) insights.push('Focus is low. Remove distractions or take a break.');
  if (energy > 70) insights.push('Energy is high — use it.');
  else if (energy < 40) insights.push('Energy seems low — consider rest or food.');
  if (stress > 60) insights.push('Stress elevated. Break tasks into smaller steps.');
  if (motivation > 70) insights.push('Motivation is high.');
  if (productivity < 50) insights.push('Productivity moderate. One focused task at a time.');
  if (insights.length === 0) insights.push('All signals nominal. Keep logging for better accuracy.');

  const src = todayEv.length > 0
    ? `${todayEv.length} events today`
    : `${allEv.length} recent events`;

  return `[ML] — ${src}\nFocus: ${focus}%  Energy: ${energy}%\nProductivity: ${productivity}%  Mood: ${mood}%\nStress: ${stress}%  Flow: ${flowLabel}\n\n${insights.join(' ')}`;
}

// ═════════════════════════════════════════════════════════════════
// ENGINE: WORKERS AI (pure Llama-3)
// ═════════════════════════════════════════════════════════════════

async function runWorkersAI(systemPrompt, history, env) {
  if (!env.AI) throw new Error('AI binding missing');
  const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [{ role: 'system', content: systemPrompt }, ...history],
    max_tokens: 400,
  });
  return `[Workers AI]\n` + (result?.response || 'No response.');
}

// ═════════════════════════════════════════════════════════════════
// ENGINE: HYBRID (ML state injected into Llama-3 context)
// ═════════════════════════════════════════════════════════════════

async function runHybrid(systemPrompt, history, env) {
  if (!env.AI) throw new Error('AI binding missing');

  // Pull live signals to inject as extra context
  const events = await getRecentEvents(10, env);
  const today = new Date().toISOString().split('T')[0];
  const todayEv = events.filter(e => e.timestamp?.startsWith(today));
  const allEv = todayEv.length > 0 ? todayEv : events.slice(0, 5);

  let mlContext = '';
  if (allEv.length > 0) {
    const energy = Math.round(allEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / allEv.length * 100);
    const stress = Math.round(allEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / allEv.length * 100);
    const focus = Math.round(allEv.reduce((s, e) => s + (e.focus_signal || 0.5), 0) / allEv.length * 100);
    const state = await getLatestState(env);
    const flow = state?.flow_class ||
      (energy > 75 && stress < 25 ? 'FLOW' : energy > 60 && stress < 40 ? 'PRE-FLOW' : 'NOMINAL');
    mlContext = `\n\n[LIVE ML SIGNALS — ${allEv.length} events] energy:${energy}% focus:${focus}% stress:${stress}% flow:${flow}`;
  }

  const result = await env.AI.run('@cf/meta/llama-3-8b-instruct', {
    messages: [{ role: 'system', content: systemPrompt + mlContext }, ...history],
    max_tokens: 400,
  });
  return `[Hybrid]\n` + (result?.response || 'No response.');
}

// ═════════════════════════════════════════════════════════════════
// MORNING BRIEFING
// ═════════════════════════════════════════════════════════════════

async function sendMorningBriefing(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const today = new Date().toISOString().split('T')[0];
  const events = await getRecentEvents(env, 50);
  const todayGoal = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const ydStr = yesterday.toISOString().split('T')[0];
  const ydEvents = events.filter(e => e.timestamp?.startsWith(ydStr));
  const avgEnergy = ydEvents.length > 0
    ? Math.round(ydEvents.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / ydEvents.length * 100)
    : null;

  const streak = await calculateStreak(events);
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayName = days[new Date().getDay()];

  let msg = `🌅 *Good morning, Avi!*\n\n📅 ${dayName} · ${today}\n🔥 Streak: ${streak} day${streak !== 1 ? 's' : ''}\n\n`;
  if (avgEnergy !== null) msg += `Yesterday: ⚡ ${avgEnergy}% energy · ${ydEvents.length} events logged\n\n`;
  if (todayGoal) msg += `🎯 *Today's goal:* ${todayGoal}\n\n`;
  else msg += `💡 Set your goal: /goal [what you want to achieve today]\n\n`;

  if (streak === 0) msg += `_Start your streak today — just send one message._`;
  else if (streak < 3) msg += `_${streak} days in. Keep the momentum going._`;
  else if (streak < 7) msg += `_${streak} days strong. You're building a habit._`;
  else if (streak < 30) msg += `_${streak} day streak. AETHER is learning your patterns._`;
  else msg += `_${streak} days. The model knows you well now._`;

  await sendTelegram(chatId, msg, env);
}

// ═════════════════════════════════════════════════════════════════
// EVENING SUMMARY
// ═════════════════════════════════════════════════════════════════

async function sendEveningSummary(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;

  const today = new Date().toISOString().split('T')[0];
  const events = await getRecentEvents(100, env);
  const todayEv = events.filter(e => e.timestamp?.startsWith(today));
  const goal = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);

  if (todayEv.length === 0) {
    await sendTelegram(chatId,
      `🌙 *Evening check-in*\n\nNo activity logged today, Avi.\n\nTomorrow: start with one message to AETHER when you wake up.\n\n_Consistency beats intensity._`, env);
    return;
  }

  const avgEnergy = Math.round(todayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / todayEv.length * 100);
  const avgStress = Math.round(todayEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / todayEv.length * 100);
  const topics = [...new Set(todayEv.map(e => e.topic).filter(Boolean))].slice(0, 4);
  const streak = await calculateStreak(events);

  let flowSummary;
  if (avgEnergy > 75 && avgStress < 25) flowSummary = '🟢 Strong flow day';
  else if (avgEnergy > 55 && avgStress < 45) flowSummary = '🟡 Decent focus day';
  else if (avgStress > 65) flowSummary = '🔴 High stress day — rest tonight';
  else if (avgEnergy < 30) flowSummary = '⚫ Low energy day — sleep early';
  else flowSummary = '⚪ Normal day';

  let msg = `🌙 *AETHER Daily Summary*\n\n`;
  msg += `📊 ${todayEv.length} events logged\n`;
  msg += `⚡ Avg energy: ${avgEnergy}%\n`;
  msg += `😤 Avg stress: ${avgStress}%\n`;
  msg += `${flowSummary}\n\n`;
  if (topics.length > 0) msg += `🧠 Topics: ${topics.join(', ')}\n`;
  if (goal) msg += `🎯 Goal was: ${goal}\n`;
  msg += `🔥 Streak: ${streak} days\n\n`;
  msg += avgEnergy < 40 || avgStress > 60
    ? `_Rest well tonight. Recovery is productive._`
    : `_Good work today. Log your state tomorrow morning to keep AETHER learning._`;

  await sendTelegram(chatId, msg, env);
}

// ═════════════════════════════════════════════════════════════════
// WEEKLY REPORT
// ═════════════════════════════════════════════════════════════════

async function sendWeeklyReport(env) {
  try {
    const events = await getRecentEvents(500, env);
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const weekEv = events.filter(e => new Date(e.timestamp) > weekAgo);

    if (weekEv.length === 0) {
      return sendTelegram(env.TELEGRAM_CHAT_ID, '📊 Weekly report: No events logged this week. Start logging!', env);
    }

    const avgEnergy = weekEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / weekEv.length;
    const avgStress = weekEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / weekEv.length;

    const byDay = {};
    weekEv.forEach(e => {
      const d = e.timestamp?.split('T')[0];
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(e.energy_signal || 0.5);
    });
    const dayAvgs = Object.entries(byDay).map(([d, vals]) => ({ d, avg: vals.reduce((s, v) => s + v, 0) / vals.length }));
    const bestDay = dayAvgs.sort((a, b) => b.avg - a.avg)[0];
    const worstDay = dayAvgs[dayAvgs.length - 1];

    const topicCount = {};
    weekEv.forEach(e => { if (e.topic) topicCount[e.topic] = (topicCount[e.topic] || 0) + 1; });
    const topTopics = Object.entries(topicCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(', ') || 'none';

    const githubCount = weekEv.filter(e => e.input_type === 'github').length;
    const healthCount = weekEv.filter(e => e.input_type === 'health').length;
    const financeCount = weekEv.filter(e => e.input_type === 'finance').length;
    const careerCount = weekEv.filter(e => e.input_type === 'career').length;
    const streak = await calculateStreak(events);

    const energyBar = '█'.repeat(Math.round(avgEnergy * 10)) + '░'.repeat(10 - Math.round(avgEnergy * 10));
    const stressBar = '█'.repeat(Math.round(avgStress * 10)) + '░'.repeat(10 - Math.round(avgStress * 10));

    const msg =
      `📊 *AETHER Weekly Report*\nWeek of ${weekAgo.toLocaleDateString('en-IN')}\n\n` +
      `*Overview*\nEvents logged: ${weekEv.length}\nCurrent streak: ${streak} days\n\n` +
      `*Energy*\n${energyBar} ${Math.round(avgEnergy * 100)}%\nBest day: ${bestDay?.d || 'n/a'}\nWorst day: ${worstDay?.d || 'n/a'}\n\n` +
      `*Stress*\n${stressBar} ${Math.round(avgStress * 100)}%\n\n` +
      `*Top topics*\n${topTopics}\n\n` +
      `*Activity breakdown*\n💻 Code pushes: ${githubCount}\n💪 Health logs: ${healthCount}\n💰 Finance logs: ${financeCount}\n💼 Career logs: ${careerCount}\n\n` +
      `*Next week focus*\n${avgEnergy < 0.5 ? '⚡ Energy is low — prioritise sleep and exercise' : avgStress > 0.5 ? '🧘 Stress is high — schedule recovery time' : '🚀 Good baseline — push harder on goals'}\n\n` +
      `Keep logging. AETHER learns from every entry. 🤖`;

    return sendTelegram(env.TELEGRAM_CHAT_ID, msg, env);
  } catch (e) {
    console.error('[AETHER] Weekly report failed:', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════
// MIDDAY NUDGE
// ═════════════════════════════════════════════════════════════════

async function middayNudge(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;
  const today = new Date().toISOString().split('T')[0];
  const events = await getRecentEvents(20, env);
  const todayEv = events.filter(e => e.timestamp?.startsWith(today) && e.input_type !== 'checkin');
  if (todayEv.length === 0) {
    await sendTelegram(chatId,
      `🌞 *Midday check*\n\nNo activity logged yet today.\nWhat are you working on?\n\nJust reply or use /goal to set your focus.`, env);
  }
}

// ═════════════════════════════════════════════════════════════════
// STREAK CALCULATOR
// ═════════════════════════════════════════════════════════════════

async function calculateStreak(events) {
  const days = new Set(events.map(e => e.timestamp?.split('T')[0]).filter(Boolean));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split('T')[0];
    if (days.has(ds)) streak++;
    else if (i > 0) break;
  }
  return streak;
}

// ═════════════════════════════════════════════════════════════════
// KV STORAGE HELPERS
// ═════════════════════════════════════════════════════════════════

async function encryptText(text, env) {
  const keyMaterial = env.ENCRYPT_KEY || 'AETHER_DEFAULT_KEY_CHANGE_IN_PROD';
  try {
    const keyData = new TextEncoder().encode(keyMaterial.padEnd(32, '0').slice(0, 32));
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['encrypt']);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const combined = new Uint8Array(iv.length + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    return '[UNENCRYPTED]:' + text;
  }
}

async function saveEvent(event, env) {
  if (!env.AETHER_KV) {
    console.warn('[AETHER] KV not available, event not saved');
    return;
  }
  try {
    const raw = await env.AETHER_KV.get('events:list');
    const events = raw ? JSON.parse(raw) : [];

    const eventToStore = { ...event };
    if (eventToStore.raw_text && eventToStore.raw_text.length > 3) {
      eventToStore.raw_text = await encryptText(eventToStore.raw_text, env);
      eventToStore.encrypted = true;
    }
    if (eventToStore.summary && eventToStore.summary.length > 3) {
      eventToStore.summary = await encryptText(eventToStore.summary, env);
      eventToStore.encrypted = true;
    }

    events.unshift(eventToStore);
    if (events.length > MAX_EVENTS) events.splice(MAX_EVENTS);

    await env.AETHER_KV.put('events:list', JSON.stringify(events));
    await env.AETHER_KV.put('events:count', String(events.length));

    // ── Trigger ML pipeline every 3 real messages ─────────────────
    const realTypes = ['text', 'voice', 'image', 'document', 'video_note'];
    if (realTypes.includes(event.input_type)) {
      const realCount = events.filter(e => realTypes.includes(e.input_type)).length;
      if (realCount >= 3 && realCount % 3 === 0 && env.GITHUB_TOKEN) {
        triggerMLPipeline(env).catch(e =>
          console.warn('[AETHER] ML trigger failed:', e.message)
        );
      }
    }
  } catch (e) {
    console.error('[AETHER] saveEvent failed:', e.message);
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
    const raw = await env.AETHER_KV.get(`state:${today}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function refreshDashboardFromState(stateVector, env) {
  if (!env.AETHER_KV) return;
  try {
    const existing = await env.AETHER_KV.get('dashboard:latest');
    const dash = existing ? JSON.parse(existing) : defaultDashboard();
    dash.metrics.focus = Math.round((stateVector.energy || 0.5) * 100);
    dash.metrics.mood = Math.round((1 - (stateVector.stress || 0.2)) * 100);
    dash.metrics.productivity = Math.round((stateVector.flow_prob || 0.3) * 100);
    dash.metrics.last_updated = new Date().toISOString();
    dash.state = stateVector;
    await env.AETHER_KV.put('dashboard:latest', JSON.stringify(dash));
  } catch (e) {
    console.warn('[AETHER] refreshDashboard failed:', e.message);
  }
}

// ═════════════════════════════════════════════════════════════════
// FLOATING BRAIN (COGNITIVE UI)
// ═════════════════════════════════════════════════════════════════

function floatingBrain(events) {
  const latest = events[events.length - 1] || {};

  // 🔥 Flow detected
  if (latest.energy_signal > 0.7 && latest.focus_signal > 0.7) {
    return { type: "flow", title: "Deep Work", priority: 1 };
  }

  // ⚠️ Distraction
  if (latest.focus_signal < 0.4) {
    return { type: "distraction", title: "Refocus", priority: 2 };
  }

  return null;
}

async function updateTabs(env, newTab) {
  let tabs = await env.AETHER_KV.get("tabs:active", { type: "json" }) || [];

  // ❌ prevent duplicates
  const exists = tabs.find(t => t.type === newTab.type);
  if (exists) return tabs;

  tabs.push({
    ...newTab,
    created_at: new Date().toISOString()
  });

  // 👇 PRIORITY SORT
  tabs.sort((a, b) => a.priority - b.priority);

  // 👇 ADD TAB EXPIRY (2 hours)
  tabs = tabs.filter(t => {
    const age = Date.now() - new Date(t.created_at).getTime();
    return age < 2 * 60 * 60 * 1000; // 2 hours
  });

  // 👇 LIMIT TABS
  tabs = tabs.slice(0, 5);

  await env.AETHER_KV.put("tabs:active", JSON.stringify(tabs));

  return tabs;
}

function defaultDashboard() {
  return {
    metrics: { focus: 0, learning: 0, productivity: 0, mood: 0, last_updated: null },
    state: null,
    activity: [],
    timeline: [],
    goals: { today: [], week: [] },
    insights: [{ icon: '🌱', title: 'Fresh Start', body: 'Send messages to your Telegram bot to start logging. Every message trains your model.', tag: 'START', tagClass: 'tag-ok' }],
    streak: 0,
    weekData: [0, 0, 0, 0, 0, 0, 0],
    inputCounts: {},
    hourlyData: new Array(24).fill(0),
    todayCount: 0,
    flowLabel: 'NOMINAL',
    pipeline: [
      { icon: '📥', name: 'pull_events.py', sub: 'KV → events.csv', status: 'READY', cls: 'ps-ok' },
      { icon: '🧹', name: 'data_cleaner.py', sub: 'Remove bad events', status: 'READY', cls: 'ps-ok' },
      { icon: '🏋', name: 'train_models.py', sub: 'RandomForest + GBM', status: 'WAITING', cls: 'ps-warn' },
      { icon: '🔮', name: 'predict.py', sub: 'Flow + peak hour', status: 'WAITING', cls: 'ps-warn' },
      { icon: '📤', name: 'push_dashboard.py', sub: 'Predictions → KV', status: 'READY', cls: 'ps-ok' },
    ],
  };
}