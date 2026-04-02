var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// api/worker.js
async function sendJarvisAlert(env, chatId, type, message) {
  const lastAlert = await env.AETHER_KV.get("last_alert");
  if (lastAlert === type) return;
  await sendTelegram(chatId, message, env);
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
  await env.AETHER_KV.put("last_alert", type);
}
__name(sendJarvisAlert, "sendJarvisAlert");
function analyzePatterns(events) {
  if (events.length < 10) {
    return {
      bestHour: "--",
      trend: "collecting data"
    };
  }
  const hourMap = {};
  events.forEach((e) => {
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
  const recent = events.slice(-10).map((e) => e.energy_signal || 0.5);
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
__name(analyzePatterns, "analyzePatterns");
async function getRecentEvents(env, limit = 20) {
  const events = await env.AETHER_KV.get("events:list", { type: "json" }) || [];
  return events.slice(-limit);
}
__name(getRecentEvents, "getRecentEvents");
async function getDashboard(env) {
  return await env.AETHER_KV.get("dashboard:latest", { type: "json" }) || {};
}
__name(getDashboard, "getDashboard");
function analyzeState(events, dashboard) {
  if (!events.length) return { state: "unknown" };
  const last = events[events.length - 1];
  const energy = last.energy_signal ?? dashboard.avg_energy ?? 0.5;
  const stress = last.stress_signal ?? dashboard.avg_stress ?? 0.3;
  const focus = last.focus_signal ?? 0.5;
  let state = "neutral";
  let advice = "";
  if (energy < 0.3 && stress > 0.6) {
    state = "burnout";
    advice = "You\u2019re mentally drained. Take a full break. No heavy tasks.";
  } else if (focus < 0.4) {
    state = "low_focus";
    advice = "Your focus is low. Do small tasks or reset (walk, water, no screens).";
  } else if (energy > 0.7 && focus > 0.6) {
    state = "flow_ready";
    advice = "You are in peak state. Start deep work NOW.";
  } else {
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
__name(analyzeState, "analyzeState");
async function handleCommand(text, chatId, env) {
  const parts = text.trim().split(" ");
  const command = parts[0].toLowerCase();
  const args = parts.slice(1).join(" ");
  switch (command) {
    case "/help":
    case "/start": {
      await sendTelegram(
        chatId,
        `\u{1F916} *AETHER OS \u2014 Commands*

/stats \u2014 weekly performance summary
/flow  \u2014 are you in flow right now?
/goal  \u2014 set today's main goal
/mood  \u2014 quick mood check-in
/week  \u2014 7-day activity overview

Or just send any message, voice note, or photo and AETHER will log it.`,
        env
      );
      return true;
    }
    case "/stats": {
      const events = await getRecentEvents(env, 50);
      if (events.length === 0) {
        await sendTelegram(chatId, "\u{1F4CA} No data yet. Send some messages first!", env);
        return true;
      }
      const avgEnergy = events.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / events.length;
      const avgStress = events.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / events.length;
      const studySessions = events.filter((e) => e.is_study_session).length;
      const topics = [...new Set(events.map((e) => e.topic).filter(Boolean))].slice(0, 5);
      const checkins = events.filter((e) => e.input_type === "checkin").length;
      await sendTelegram(
        chatId,
        `\u{1F4CA} *AETHER Weekly Stats*

Events logged: ${events.length}
Study sessions: ${studySessions}
Check-ins: ${checkins}

\u26A1 Avg energy: ${Math.round(avgEnergy * 100)}%
\u{1F624} Avg stress: ${Math.round(avgStress * 100)}%

\u{1F9E0} Topics: ${topics.join(", ") || "none yet"}

Keep logging \u2014 model trains after 30 days!`,
        env
      );
      return true;
    }
    case "/flow": {
      const state = await getLatestState(env);
      const events = await getRecentEvents(5, env);
      const recentEnergy = events.length > 0 ? events.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / events.length : 0.5;
      const recentStress = events.length > 0 ? events.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / events.length : 0.2;
      let flowStatus, advice;
      if (state) {
        flowStatus = state.flow_class || "UNKNOWN";
        if (flowStatus === "FLOW") advice = "You are in flow. Protect this time \u2014 no distractions.";
        else if (flowStatus === "PRE_FLOW") advice = "Almost there. One focused task to enter flow.";
        else if (flowStatus === "ANXIETY") advice = "Challenge too high. Break the task into smaller pieces.";
        else if (flowStatus === "RECOVERY") advice = "Rest mode. Light tasks only.";
        else advice = "Log your state with the check-in to get a flow reading.";
      } else if (recentEnergy > 0.7 && recentStress < 0.3) {
        flowStatus = "FLOW";
        advice = "Recent messages suggest flow. Stay focused!";
      } else {
        flowStatus = "NOMINAL";
        advice = "Open the AETHER dashboard and log your state for a precise reading.";
      }
      await sendTelegram(
        chatId,
        `\u{1F3AF} *Flow State*

Status: *${flowStatus}*
Energy: ${Math.round(recentEnergy * 100)}%
Stress: ${Math.round(recentStress * 100)}%

${advice}`,
        env
      );
      return true;
    }
    case "/goal": {
      if (!args) {
        await sendTelegram(chatId, "\u{1F3AF} What is your main goal today? Usage: /goal [your goal]", env);
        return true;
      }
      const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      await env.AETHER_KV.put(`goal:${today}`, args);
      await saveEvent({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        input_type: "goal",
        raw_text: args,
        topic: "goal setting",
        sentiment: "positive",
        energy_signal: 0.7,
        stress_signal: 0.1,
        is_goal_mention: true,
        summary: args
      }, env);
      await sendTelegram(chatId, `\u2705 Goal set: *${args}*

AETHER will track this today.`, env);
      return true;
    }
    case "/mood": {
      const moodMap = {
        "1": { label: "Very low", energy: 0.1, stress: 0.6 },
        "2": { label: "Low", energy: 0.3, stress: 0.4 },
        "3": { label: "Neutral", energy: 0.5, stress: 0.3 },
        "4": { label: "Good", energy: 0.7, stress: 0.2 },
        "5": { label: "Excellent", energy: 0.9, stress: 0.1 }
      };
      if (!args || !moodMap[args]) {
        await sendTelegram(chatId, "\u{1F60A} Rate your mood: /mood 1-5 (1=very low, 3=neutral, 5=excellent)", env);
        return true;
      }
      const mood = moodMap[args];
      await saveEvent({
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        input_type: "mood",
        raw_text: `mood: ${mood.label}`,
        topic: "mood check-in",
        energy_signal: mood.energy,
        stress_signal: mood.stress,
        sentiment: args >= "4" ? "positive" : args === "3" ? "neutral" : "negative",
        summary: `Mood rated ${args}/5: ${mood.label}`
      }, env);
      await sendTelegram(
        chatId,
        `${args >= "4" ? "\u{1F60A}" : args === "3" ? "\u{1F610}" : "\u{1F614}"} Mood logged: *${mood.label}* (${args}/5)

Energy: ${Math.round(mood.energy * 100)}%`,
        env
      );
      return true;
    }
    case "/week": {
      const events = await getRecentEvents(100, env);
      const days = {};
      events.forEach((e) => {
        const day = e.timestamp?.split("T")[0];
        if (day) {
          if (!days[day]) days[day] = { count: 0, energy: [] };
          days[day].count++;
          days[day].energy.push(e.energy_signal || 0.5);
        }
      });
      const dayLines = Object.entries(days).slice(0, 7).map(([day, d]) => {
        const avg = d.energy.reduce((s, v) => s + v, 0) / d.energy.length;
        const bar = "\u2588".repeat(Math.round(avg * 5)) + "\u2591".repeat(5 - Math.round(avg * 5));
        return `${day}: ${bar} ${d.count} events`;
      }).join("\n");
      await sendTelegram(
        chatId,
        `\u{1F4C5} *7-Day Activity*

\`\`\`
${dayLines || "No data yet"}
\`\`\`

Keep logging daily!`,
        env
      );
      return true;
    }
    case "/trace": {
      let trace = function(target, visited = /* @__PURE__ */ new Set()) {
        if (visited.has(target)) return [];
        visited.add(target);
        const callers = graph.edges.filter((e) => e.to === target).map((e) => e.from);
        if (callers.length === 0) {
          return [[target]];
        }
        let paths2 = [];
        for (const caller of callers) {
          const subPaths = trace(caller, visited);
          for (const p of subPaths) {
            paths2.push([...p, target]);
          }
        }
        return paths2;
      };
      __name(trace, "trace");
      const fn = args.trim();
      if (!fn) {
        await sendTelegram(
          chatId,
          "Usage: /trace functionName\nExample: /trace triggerMLPipeline",
          env
        );
        return true;
      }
      const raw = await env.AETHER_KV.get("code_graph");
      if (!raw) {
        await sendTelegram(chatId, "Code graph not loaded.", env);
        return true;
      }
      const graph = JSON.parse(raw);
      const paths = trace(fn);
      if (!paths.length) {
        await sendTelegram(chatId, `No trace found for ${fn}`, env);
        return true;
      }
      let msg = `\u{1F9E0} Code Trace for *${fn}*

`;
      paths.forEach((p, i) => {
        msg += `Flow ${i + 1}
`;
        msg += p.join("\n\u2193\n");
        msg += "\n\n";
      });
      await sendTelegram(chatId, msg, env);
      return true;
    }
    case "/briefing":
    case "/morning": {
      await sendMorningBriefing(env);
      return true;
    }
    case "/summary":
    case "/evening": {
      await sendEveningSummary(env);
      return true;
    }
    case "/automate": {
      if (!args) {
        await sendTelegram(
          chatId,
          `\u26A1 *AETHER Automations*

/automate notion    \u2014 log today to Notion
/automate spotify   \u2014 open flow playlist
/automate nudge     \u2014 send me a smart nudge
/automate checkin   \u2014 send check-in reminder
/automate webhook [url] \u2014 call custom URL`,
          env
        );
        return true;
      }
      const subAction = args.split(" ")[0];
      const actionMap = {
        "notion": "notion_log",
        "spotify": "spotify_flow",
        "nudge": "smart_nudge",
        "checkin": "checkin_reminder"
      };
      if (subAction === "webhook") {
        const webhookUrl = args.split(" ")[1];
        if (!webhookUrl) {
          await sendTelegram(chatId, "\u26A0\uFE0F Usage: /automate webhook https://yoururl.com", env);
          return true;
        }
        await handleTrigger(new Request("https://x/trigger", {
          method: "POST",
          body: JSON.stringify({ action: "webhook", data: { url: webhookUrl } })
        }), env);
        await sendTelegram(chatId, "\u2705 Webhook triggered!", env);
        return true;
      }
      const mappedAction = actionMap[subAction];
      if (!mappedAction) {
        await sendTelegram(chatId, `\u26A0\uFE0F Unknown automation: ${subAction}. Try /automate for list.`, env);
        return true;
      }
      await handleTrigger(new Request("https://x/trigger", {
        method: "POST",
        body: JSON.stringify({ action: mappedAction })
      }), env);
      return true;
    }
    case "/streak": {
      const events = await getRecentEvents(100, env);
      const streak = await calculateStreak(events);
      const total = events.length;
      await sendTelegram(
        chatId,
        `\u{1F525} *Streak: ${streak} day${streak !== 1 ? "s" : ""}*

Total events logged: ${total}
Keep logging daily to maintain your streak!`,
        env
      );
      return true;
    }
    case "/exercise":
    case "/workout": {
      const actType = args.replace(/[0-9]+/g, "").trim() || "workout";
      const mins = parseInt(args.match(/[0-9]+/)?.[0]) || 30;
      await saveEvent({
        input_type: "health",
        raw_text: text,
        topic: "Exercise",
        topics: ["health", "fitness"],
        energy_signal: 0.75,
        stress_signal: 0.1,
        focus_signal: 0.6,
        motivation_signal: 0.8,
        dominant_emotion: "energized",
        is_study_session: false,
        is_goal_mention: false,
        estimated_minutes: mins,
        health_type: "exercise",
        activity: actType,
        duration_mins: mins,
        summary: `Exercise: ${actType} ${mins}min`
      }, env);
      await sendTelegram(chatId, `\u{1F4AA} *Exercise logged*

${actType} \u2014 ${mins} min
Energy: +0.75 recorded \u{1F525}`, env);
      return true;
    }
    case "/sleep": {
      const hrs = parseFloat(args) || 7;
      const quality = hrs >= 8 ? "great" : hrs >= 6 ? "ok" : "poor";
      const energy = hrs >= 8 ? 0.85 : hrs >= 6 ? 0.6 : 0.35;
      await saveEvent({
        input_type: "health",
        raw_text: text,
        topic: "Sleep",
        topics: ["health", "sleep", "recovery"],
        energy_signal: energy,
        stress_signal: hrs < 6 ? 0.5 : 0.1,
        focus_signal: energy,
        motivation_signal: energy,
        dominant_emotion: hrs < 6 ? "tired" : "rested",
        is_study_session: false,
        is_goal_mention: false,
        health_type: "sleep",
        sleep_hours: hrs,
        sleep_quality: quality,
        summary: `Sleep: ${hrs}h (${quality})`
      }, env);
      await sendTelegram(
        chatId,
        `\u{1F634} *Sleep logged*

${hrs}h \u2014 ${quality.toUpperCase()}
Energy forecast: ${Math.round(energy * 100)}%

${hrs < 6 ? "\u26A0\uFE0F Low sleep \u2014 take it easy." : hrs >= 8 ? "\u2705 Well rested!" : "\u{1F44D} Decent sleep."}`,
        env
      );
      return true;
    }
    case "/food":
    case "/meal": {
      const meal = args || "meal";
      await saveEvent({
        input_type: "health",
        raw_text: text,
        topic: "Food",
        topics: ["health", "nutrition"],
        energy_signal: 0.5,
        stress_signal: 0.05,
        focus_signal: 0.4,
        motivation_signal: 0.5,
        dominant_emotion: "neutral",
        is_study_session: false,
        is_goal_mention: false,
        health_type: "food",
        meal_description: meal,
        summary: `Meal: ${meal}`
      }, env);
      await sendTelegram(chatId, `\u{1F37D}\uFE0F *Meal logged*

${meal}

Fuel in the tank! \u{1F4AA}`, env);
      return true;
    }
    case "/water":
    case "/hydrate": {
      const litres = parseFloat(args) || 0.5;
      await saveEvent({
        input_type: "health",
        raw_text: text,
        topic: "Hydration",
        topics: ["health", "water"],
        energy_signal: 0.55,
        stress_signal: 0.05,
        focus_signal: 0.5,
        motivation_signal: 0.55,
        dominant_emotion: "neutral",
        health_type: "water",
        litres,
        summary: `Water: ${litres}L`
      }, env);
      await sendTelegram(chatId, `\u{1F4A7} *Water logged*

${litres}L

Brain runs on water \u{1F9E0}`, env);
      return true;
    }
    case "/weight": {
      const kg = parseFloat(args);
      if (!kg || kg < 30 || kg > 250) {
        await sendTelegram(chatId, "\u2696\uFE0F Usage: /weight 72.5", env);
        return true;
      }
      await saveEvent({
        input_type: "health",
        raw_text: text,
        topic: "Weight",
        topics: ["health", "fitness"],
        energy_signal: 0.5,
        stress_signal: 0.1,
        focus_signal: 0.5,
        motivation_signal: 0.6,
        dominant_emotion: "neutral",
        health_type: "weight",
        weight_kg: kg,
        summary: `Weight: ${kg}kg`
      }, env);
      await sendTelegram(chatId, `\u2696\uFE0F *Weight logged*

${kg} kg

Tracking \u2192 trending \u2192 improving \u{1F4C8}`, env);
      return true;
    }
    case "/spend":
    case "/expense": {
      if (!args) {
        await sendTelegram(chatId, "\u{1F4B8} Usage: /spend 200 food", env);
        return true;
      }
      const spendParts = args.split(" ");
      const amount = parseFloat(spendParts[0]) || 0;
      const cat = spendParts.slice(1).join(" ") || "general";
      await saveEvent({
        input_type: "finance",
        raw_text: text,
        topic: "Expense",
        topics: ["money", "spending", cat],
        energy_signal: 0.5,
        stress_signal: 0.15,
        focus_signal: 0.4,
        motivation_signal: 0.5,
        dominant_emotion: "neutral",
        finance_type: "expense",
        amount_inr: amount,
        category: cat,
        summary: `Spent Rs${amount} on ${cat}`
      }, env);
      await sendTelegram(chatId, `\u{1F4B8} *Expense logged*

Rs${amount} \u2014 ${cat}

Every rupee tracked \u{1F4B0}`, env);
      return true;
    }
    case "/income":
    case "/earn": {
      if (!args) {
        await sendTelegram(chatId, "\u{1F4B0} Usage: /income 5000 freelance", env);
        return true;
      }
      const earnParts = args.split(" ");
      const earned = parseFloat(earnParts[0]) || 0;
      const src = earnParts.slice(1).join(" ") || "income";
      await saveEvent({
        input_type: "finance",
        raw_text: text,
        topic: "Income",
        topics: ["money", "income", src],
        energy_signal: 0.85,
        stress_signal: 0.05,
        focus_signal: 0.7,
        motivation_signal: 0.9,
        dominant_emotion: "joy",
        finance_type: "income",
        amount_inr: earned,
        source: src,
        summary: `Income: Rs${earned} from ${src}`
      }, env);
      await sendTelegram(chatId, `\u{1F4B0} *Income logged*

Rs${earned} from ${src}

Money flowing in! Keep building \u{1F680}`, env);
      return true;
    }
    case "/job":
    case "/apply": {
      const company = args || "company";
      await saveEvent({
        input_type: "career",
        raw_text: text,
        topic: "Job Application",
        topics: ["career", "jobs"],
        energy_signal: 0.7,
        stress_signal: 0.3,
        focus_signal: 0.6,
        motivation_signal: 0.75,
        dominant_emotion: "determined",
        career_type: "application",
        company,
        summary: `Applied: ${company}`
      }, env);
      await sendTelegram(chatId, `\u{1F4CB} *Job application logged*

Company: ${company}

Consistency wins. Keep applying! \u{1F3AF}`, env);
      return true;
    }
    case "/interview": {
      const co = args || "company";
      await saveEvent({
        input_type: "career",
        raw_text: text,
        topic: "Interview",
        topics: ["career", "interview"],
        energy_signal: 0.8,
        stress_signal: 0.5,
        focus_signal: 0.8,
        motivation_signal: 0.85,
        dominant_emotion: "focused",
        career_type: "interview",
        company: co,
        summary: `Interview: ${co}`
      }, env);
      await sendTelegram(chatId, `\u{1F3AF} *Interview logged*

${co}

You got this! \u{1F4AA}`, env);
      return true;
    }
    case "/commands": {
      await sendTelegram(
        chatId,
        `*AETHER Commands* \u{1F916}

*\u{1F4CA} CORE*
/goal [text] \u2014 set today goal
/mood [1-5] \u2014 quick mood log
/stats \u2014 weekly summary
/flow \u2014 current flow state

*\u{1F4AA} HEALTH*
/exercise [mins] [type]
/sleep [hours]
/food [description]
/water [litres]
/weight [kg]

*\u{1F4B0} MONEY*
/spend [amount] [category]
/income [amount] [source]

*\u{1F4BC} CAREER*
/job [company] \u2014 log application
/interview [company]

*\u{1F4C8} INSIGHTS*
/week /streak /morning /evening`,
        env
      );
      return true;
    }
    default:
      return false;
  }
}
__name(handleCommand, "handleCommand");
var MAX_EVENTS = 500;
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type"
};
function jsonResp(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", ...CORS_HEADERS }
  });
}
__name(jsonResp, "jsonResp");
function textResp(text, status = 200) {
  return new Response(text, {
    status,
    headers: { "Content-Type": "text/plain", ...CORS_HEADERS }
  });
}
__name(textResp, "textResp");
var worker_default = {
  async scheduled(event, env, ctx) {
    const hour = (/* @__PURE__ */ new Date()).getUTCHours();
    const dayOfWeek = (/* @__PURE__ */ new Date()).getUTCDay();
    if (hour === 3) ctx.waitUntil(sendMorningBriefing(env));
    if (hour === 15) ctx.waitUntil(sendEveningSummary(env));
    if (hour === 7) ctx.waitUntil(middayNudge(env));
    if (hour === 15 && dayOfWeek === 0) ctx.waitUntil(sendWeeklyReport(env));
  },
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }
    const url = new URL(request.url);
    console.log("PATH:", url.pathname);
    try {
      if (url.pathname === "/knowledge") {
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
      if (url.pathname === "/webhook" && request.method === "POST") return handleWebhook(request, env);
      if (url.pathname === "/chat" && request.method === "POST") {
        let energyLabel = function(e) {
          if (e > 0.7) return "high";
          if (e > 0.4) return "moderate";
          return "low";
        }, getTrend = function(events2) {
          if (events2.length < 5) return "stable";
          const recent = events2.slice(-5).map((e) => e.energy_signal || 0.5);
          const diff = recent[recent.length - 1] - recent[0];
          if (diff > 0.1) return "increasing";
          if (diff < -0.1) return "decreasing";
          return "stable";
        };
        __name(energyLabel, "energyLabel");
        __name(getTrend, "getTrend");
        console.log("\u2705 NEW JARVIS CORE HIT");
        const body = await request.json();
        const userMessage = body.message?.toLowerCase() || "";
        const events = await getRecentEvents(env);
        const dashboard = await getDashboard(env);
        const analysis = analyzeState(events, dashboard);
        const patterns = analyzePatterns(events);
        const patternText = `
      \u{1F4CA} Pattern Insight:
      Best hour: ${patterns.bestHour}:00
      Trend: ${patterns.trend}
      `;
        const energyText = energyLabel(analysis.energy);
        const trend = getTrend(events);
        let response = "";
        if (userMessage.includes("what should i do")) {
          response = analysis.advice;
        } else if (userMessage.includes("status")) {
          response = `\u{1F9E0} JARVIS STATUS

      \u26A1 Energy: ${energyText} (${analysis.energy.toFixed(2)})
      \u{1F525} State: ${analysis.state}
      \u{1F624} Stress: ${analysis.stress.toFixed(2)}
      \u{1F3AF} Focus: ${analysis.focus.toFixed(2)}
      \u{1F4C8} Trend: ${trend}`;
        } else {
          response = analysis.advice;
        }
        const finalResponse = `\u{1F9E0} JARVIS CORE

      \u26A1 Energy: ${energyText}
      \u{1F525} State: ${analysis.state}
      \u{1F4C8} Trend: ${trend}

      \u{1F4CC} Recommendation:
      ${response}

      ${patternText}
      `;
        console.log("PATTERN:", patternText);
        return new Response(JSON.stringify({ reply: finalResponse }), {
          headers: { "Content-Type": "application/json" }
        });
      }
      if (url.pathname === "/log-state" && request.method === "POST") return handleLogState(request, env);
      if (url.pathname === "/dashboard" && request.method === "GET") return handleDashboard(request, env);
      if (url.pathname === "/events" && request.method === "GET") return handleEvents(request, env);
      if (url.pathname === "/update-dashboard" && request.method === "POST") return handleUpdateDashboard(request, env);
      if (url.pathname === "/reset-data" && request.method === "POST") return handleResetData(request, env);
      if (url.pathname === "/log-github" && request.method === "POST") return handleGitHubLog(request, env);
      if (url.pathname === "/trigger" && request.method === "POST") return handleTrigger(request, env);
      if (url.pathname === "/health" && request.method === "GET") return handleHealth(request, env);
      if (url.pathname === "/knowledge" && request.method === "GET") {
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
      if (url.pathname === "/update-code-graph" && request.method === "POST") {
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
      if (url.pathname === "/code" && request.method === "GET") {
        const fn = url.searchParams.get("fn");
        const raw = await env.AETHER_KV.get("code_graph");
        if (!raw) {
          return jsonResp({ error: "code graph not loaded" });
        }
        const graph = JSON.parse(raw);
        const defined = graph.nodes.filter((n) => n.name === fn).map((n) => n.file);
        const calls = graph.edges.filter((e) => e.from === fn).map((e) => e.to);
        const used = graph.edges.filter((e) => e.to === fn).map((e) => e.from);
        return jsonResp({
          function: fn,
          defined_in: defined,
          calls: [...new Set(calls)],
          used_in: [...new Set(used)]
        });
      }
      if (url.pathname === "/codepath" && request.method === "GET") {
        let trace = function(target, visited = /* @__PURE__ */ new Set()) {
          if (visited.has(target)) return [];
          visited.add(target);
          const callers = graph.edges.filter((e) => e.to === target).map((e) => e.from);
          if (callers.length === 0) {
            return [[target]];
          }
          let paths2 = [];
          for (const caller of callers) {
            const subPaths = trace(caller, visited);
            for (const p of subPaths) {
              paths2.push([...p, target]);
            }
          }
          return paths2;
        };
        __name(trace, "trace");
        const fn = url.searchParams.get("fn");
        const raw = await env.AETHER_KV.get("code_graph");
        if (!raw) {
          return jsonResp({ error: "code graph not loaded" });
        }
        const graph = JSON.parse(raw);
        const paths = trace(fn);
        return jsonResp({
          function: fn,
          paths
        });
      }
      if (url.pathname.startsWith("/api")) {
        return jsonResp({ status: "AETHER API ONLINE", version: "2.1" });
      }
      return env.ASSETS.fetch(request);
    } catch (err) {
      console.error("[AETHER] Unhandled error:", err);
      return jsonResp({ error: "Internal server error", detail: err.message }, 500);
    }
  }
};
async function handleWebhook(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return textResp("Bad JSON", 400);
  }
  const msg = body?.message || body?.edited_message;
  if (!msg) return textResp("No message", 200);
  const chatId = msg.chat?.id?.toString();
  const timestamp = new Date(msg.date * 1e3).toISOString();
  if (env.TELEGRAM_CHAT_ID && chatId !== env.TELEGRAM_CHAT_ID.toString()) {
    console.warn("[AETHER] Rejected message from unknown chat:", chatId);
    return textResp("Unauthorized", 200);
  }
  let rawText = "";
  let inputType = "text";
  let extra = {};
  if (msg.text) {
    if (msg.text.startsWith("/")) {
      const handled = await handleCommand(msg.text, chatId, env);
      if (handled) return textResp("OK", 200);
    }
    rawText = msg.text;
    inputType = "text";
  } else if (msg.voice) {
    if (!env.AI) {
      await sendTelegram(chatId, "\u{1F399} Voice noted! AI binding not configured yet.", env);
      return textResp("No AI binding", 200);
    }
    await sendTelegram(chatId, "\u{1F399} Transcribing...", env);
    try {
      const fileUrl = await getTelegramFileUrl(msg.voice.file_id, env);
      rawText = await whisperTranscribe(fileUrl, env);
      inputType = "voice";
      extra.duration_seconds = msg.voice.duration;
    } catch (e) {
      await sendTelegram(chatId, "\u26A0\uFE0F Could not transcribe: " + e.message, env);
      return textResp("Voice error", 200);
    }
  } else if (msg.video_note) {
    if (!env.AI) {
      await sendTelegram(chatId, "\u{1F3A5} Video noted! AI binding not configured yet.", env);
      return textResp("No AI binding", 200);
    }
    await sendTelegram(chatId, "\u{1F3A5} Processing video...", env);
    try {
      const fileUrl = await getTelegramFileUrl(msg.video_note.file_id, env);
      rawText = await whisperTranscribe(fileUrl, env);
      inputType = "video_note";
      extra.duration_seconds = msg.video_note.duration;
    } catch (e) {
      await sendTelegram(chatId, "\u26A0\uFE0F Could not process video: " + e.message, env);
      return textResp("Video error", 200);
    }
  } else if (msg.photo) {
    await sendTelegram(chatId, "\u{1F5BC} Reading image...", env);
    try {
      const bestPhoto = msg.photo[msg.photo.length - 1];
      const fileUrl = await getTelegramFileUrl(bestPhoto.file_id, env);
      rawText = await openaiVisionExtract(fileUrl, msg.caption || "", env);
      inputType = "image";
    } catch (e) {
      await sendTelegram(chatId, "\u26A0\uFE0F Could not read image: " + e.message, env);
      return textResp("Image error", 200);
    }
  } else if (msg.document) {
    const mime = msg.document.mime_type || "";
    if (mime === "text/plain") {
      try {
        const fileUrl = await getTelegramFileUrl(msg.document.file_id, env);
        const resp = await fetch(fileUrl);
        rawText = await resp.text();
        inputType = "document";
      } catch (e) {
        await sendTelegram(chatId, "\u26A0\uFE0F Could not read document: " + e.message, env);
        return textResp("Doc error", 200);
      }
    } else {
      await sendTelegram(chatId, "\u{1F4CE} Only .txt documents are supported right now.", env);
      return textResp("Unsupported doc type", 200);
    }
  } else {
    return textResp("Unsupported message type", 200);
  }
  if (!rawText.trim()) {
    await sendTelegram(chatId, "\u{1F914} Could not extract any text from that.", env);
    return textResp("Empty text", 200);
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
    ...extra
  };
  await saveEvent(event, env);
  const events = await getRecentEvents(env);
  const dashboard = await getDashboard(env);
  const analysis = analyzeState(events, dashboard);
  const lastAlert = await env.AETHER_KV.get("last_alert");
  if (analysis.state === "flow_ready") {
    await sendJarvisAlert(
      env,
      chatId,
      "flow",
      "\u{1F680} FLOW DETECTED \u2014 Start deep work NOW"
    );
  }
  if (analysis.state === "low_focus") {
    await sendJarvisAlert(
      env,
      chatId,
      "focus",
      "\u26A0\uFE0F Focus dropping \u2014 take 5 min reset"
    );
  }
  if (analysis.state === "burnout") {
    await sendJarvisAlert(
      env,
      chatId,
      "burnout",
      "\u{1F9E0} Burnout detected \u2014 stop and rest"
    );
  }
  if (analysis.state === "moderate") {
    await env.AETHER_KV.put("last_alert", "none");
  }
  const baseReply = buildTelegramReply(parsed, inputType, rawText);
  const jarvisReply = `

  \u{1F9E0} *JARVIS*
  \u26A1 Energy: ${analysis.energy.toFixed(2)}
  \u{1F525} State: ${analysis.state}

  ${analysis.advice}
  `;
  await sendTelegram(chatId, baseReply + jarvisReply, env);
}
__name(handleWebhook, "handleWebhook");
async function handleLogState(request, env) {
  let stateVector;
  try {
    stateVector = await request.json();
  } catch {
    return jsonResp({ error: "Bad JSON" }, 400);
  }
  if (!stateVector.state_label || stateVector.energy === void 0) {
    return jsonResp({ error: "Missing required fields: state_label, energy" }, 400);
  }
  stateVector.server_timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  await env.AETHER_KV.put(`state:${today}`, JSON.stringify(stateVector));
  const event = {
    timestamp: stateVector.server_timestamp,
    input_type: "checkin",
    state_label: stateVector.state_label,
    energy: stateVector.energy,
    stress: stateVector.stress,
    mood: stateVector.mood,
    flow_prob: stateVector.flow_prob,
    flow_class: stateVector.flow_class,
    goal: stateVector.goal,
    mods: (stateVector.mods || []).join(",")
  };
  await saveEvent(event, env);
  await refreshDashboardFromState(stateVector, env);
  console.log("[AETHER] State logged:", stateVector.state_label, "| energy:", stateVector.energy);
  return jsonResp({ ok: true, message: "State synced to AETHER" });
}
__name(handleLogState, "handleLogState");
async function handleDashboard(request, env) {
  try {
    const events = await getRecentEvents(200, env);
    const latestState = await getLatestState(env);
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const todayEv = events.filter((e) => e.timestamp?.startsWith(today));
    const todayGoal = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);
    const streak = await calculateStreak(events);
    const avgEnergy = todayEv.length > 0 ? Math.round(todayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / todayEv.length * 100) : latestState ? Math.round((latestState.energy || 0.5) * 100) : 0;
    const avgStress = todayEv.length > 0 ? Math.round(todayEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / todayEv.length * 100) : latestState ? Math.round((latestState.stress || 0.2) * 100) : 0;
    const avgFocus = todayEv.length > 0 ? Math.round(todayEv.reduce((s, e) => s + (e.focus_signal || 0.5), 0) / todayEv.length * 100) : 0;
    const studySessions = todayEv.filter((e) => e.is_study_session).length;
    const hoursToday = Math.round(studySessions * 0.5 * 10) / 10;
    let flowProb = 0;
    if (latestState?.flow_prob) flowProb = Math.round(latestState.flow_prob * 100);
    else if (avgEnergy > 75 && avgStress < 25) flowProb = 85;
    else if (avgEnergy > 55 && avgStress < 45) flowProb = 55;
    else flowProb = 20;
    const topicCounts = {};
    todayEv.forEach((e) => {
      if (e.topic && e.topic !== "general") {
        topicCounts[e.topic] = (topicCounts[e.topic] || 0) + 1;
      }
    });
    const activity = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([topic, count]) => ({ topic, minutes: count * 25, cat: "LOGGED" }));
    const timeline = todayEv.slice(0, 8).map((e) => ({
      time: new Date(e.timestamp).toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Kolkata"
      }),
      event: `${e.input_type}: ${e.summary || e.topic || "logged"}`
    }));
    const weekData = [];
    for (let i = 6; i >= 0; i--) {
      const d = /* @__PURE__ */ new Date();
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      const dayEv = events.filter((e) => e.timestamp?.startsWith(ds));
      const dayEnergy = dayEv.length > 0 ? dayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / dayEv.length : 0;
      weekData.push(Math.round(dayEnergy * 10) / 10);
    }
    const insights = generateInsights(events, todayEv, avgEnergy, avgStress, streak);
    const goals = {
      today: todayGoal ? [{ text: todayGoal, done: false, cat: "TODAY" }] : [],
      week: []
    };
    const inputCounts = {};
    events.forEach((e) => {
      const t = e.input_type || "text";
      inputCounts[t] = (inputCounts[t] || 0) + 1;
    });
    const hourlyData = new Array(24).fill(0);
    events.forEach((e) => {
      if (e.timestamp) {
        const h = new Date(e.timestamp).getUTCHours();
        hourlyData[h] = (hourlyData[h] || 0) + 1;
      }
    });
    let flowLabel = "NOMINAL";
    if (latestState?.flow_class) flowLabel = latestState.flow_class;
    else if (avgEnergy > 75 && avgStress < 25) flowLabel = "FLOW";
    else if (avgEnergy > 60 && avgStress < 35) flowLabel = "PRE-FLOW";
    else if (avgStress > 60) flowLabel = "ANXIETY";
    else if (avgEnergy < 35) flowLabel = "RECOVERY";
    const dash = {
      metrics: {
        focus: avgFocus || avgEnergy,
        learning: Math.round(avgEnergy * 0.9),
        productivity: flowProb,
        mood: Math.round((1 - avgStress / 100) * 100),
        streak,
        hours_today: hoursToday,
        tasks_done: todayEv.filter((e) => e.is_goal_mention).length,
        total_events: events.length,
        last_updated: (/* @__PURE__ */ new Date()).toISOString()
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
        { icon: "\u{1F4E5}", name: "pull_events.py", sub: "KV \u2192 events.csv", status: "OK", cls: "ps-ok" },
        { icon: "\u{1F9F9}", name: "data_cleaner.py", sub: "Remove bad events", status: "OK", cls: "ps-ok" },
        { icon: "\u{1F3CB}", name: "train_models.py", sub: "RandomForest + GBM", status: events.length >= 10 ? "TRAINED" : "WAITING", cls: events.length >= 10 ? "ps-ok" : "ps-warn" },
        { icon: "\u{1F52E}", name: "predict.py", sub: "Flow + peak hour", status: events.length >= 10 ? "OK" : "WAITING", cls: events.length >= 10 ? "ps-ok" : "ps-warn" },
        { icon: "\u{1F4E4}", name: "push_dashboard.py", sub: "Predictions \u2192 KV", status: "OK", cls: "ps-ok" }
      ]
    };
    return new Response(JSON.stringify(dash, null, 2), {
      headers: { "Content-Type": "application/json", ...CORS_HEADERS }
    });
  } catch (e) {
    console.warn("[AETHER] Dashboard compute failed:", e.message);
    return jsonResp(defaultDashboard());
  }
}
__name(handleDashboard, "handleDashboard");
function generateInsights(events, todayEv, avgEnergy, avgStress, streak) {
  const insights = [];
  const hourEnergy = {};
  events.forEach((e) => {
    const h = new Date(e.timestamp).getUTCHours();
    if (!hourEnergy[h]) hourEnergy[h] = [];
    hourEnergy[h].push(e.energy_signal || 0.5);
  });
  const peakHour = Object.entries(hourEnergy).map(([h, vals]) => ({ h: parseInt(h), avg: vals.reduce((s, v) => s + v, 0) / vals.length })).sort((a, b) => b.avg - a.avg)[0];
  if (peakHour) {
    const istHour = (peakHour.h + 5) % 24;
    const ampm = istHour >= 12 ? "pm" : "am";
    const h12 = istHour % 12 || 12;
    insights.push({
      icon: "\u26A1",
      title: "Peak Performance Window",
      body: `Your energy peaks around ${h12}${ampm} IST based on ${events.length} logged events. Schedule your hardest tasks then.`,
      tag: "PATTERN",
      tagClass: "tag-ok"
    });
  }
  if (avgStress > 60) {
    insights.push({
      icon: "\u26A0\uFE0F",
      title: "High Stress Detected",
      body: "Your stress signals are elevated today. Break tasks into smaller steps and take short breaks.",
      tag: "WARNING",
      tagClass: "tag-med"
    });
  } else if (avgEnergy > 70) {
    insights.push({
      icon: "\u{1F525}",
      title: "High Energy Day",
      body: `Energy at ${avgEnergy}% \u2014 good conditions for deep work. Protect this window.`,
      tag: "POSITIVE",
      tagClass: "tag-ok"
    });
  }
  if (streak >= 3) {
    insights.push({
      icon: "\u{1F525}",
      title: `${streak}-Day Streak`,
      body: `You have logged data for ${streak} consecutive days. AETHER is building your behavioral model.`,
      tag: streak >= 7 ? "HIGH PRIORITY" : "POSITIVE",
      tagClass: streak >= 7 ? "tag-hi" : "tag-ok"
    });
  }
  if (todayEv.length === 0) {
    insights.push({
      icon: "\u{1F4A1}",
      title: "No Data Today Yet",
      body: "Send a message to your Telegram bot to start logging today activity.",
      tag: "ACTION",
      tagClass: "tag-med"
    });
  }
  return insights.slice(0, 3);
}
__name(generateInsights, "generateInsights");
async function handleEvents(request, env) {
  try {
    let events = await env.AETHER_KV.get("events:list", { type: "json" });
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
__name(handleEvents, "handleEvents");
async function handleHealth(request, env) {
  const kvOk = !!env.AETHER_KV;
  const openaiOk = !!env.OPENAI_API_KEY;
  const telegramOk = !!env.TELEGRAM_BOT_TOKEN;
  const chatIdOk = !!env.TELEGRAM_CHAT_ID;
  const eventCount = await getEventCount(env);
  const coreReady = kvOk && !!env.AI && telegramOk && chatIdOk;
  return jsonResp({
    status: coreReady ? "AETHER ONLINE \u2705" : "AETHER PARTIAL \u26A0\uFE0F",
    version: "2.1",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    services: {
      kv: kvOk ? "OK" : "\u274C MISSING",
      cf_ai: env.AI ? "OK" : "\u274C MISSING \u2014 add [ai] to wrangler.toml",
      telegram_token: telegramOk ? "OK" : "\u274C MISSING",
      telegram_chat_id: chatIdOk ? "OK" : "\u274C MISSING",
      openai: openaiOk ? "OK" : "\u26AA OPTIONAL"
    },
    data: { total_events: eventCount }
  });
}
__name(handleHealth, "handleHealth");
async function handleTrigger(request, env) {
  try {
    const body = await request.json();
    const action = body.action;
    const data = body.data || {};
    console.log("[AETHER] Trigger:", action);
    switch (action) {
      case "smart_nudge": {
        const state = await getLatestState(env);
        const events = await getRecentEvents(env, 5);
        const avgE = events.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / Math.max(events.length, 1);
        let msg;
        if (!state && events.length === 0) msg = "\u{1F44B} AETHER here. No data logged today yet. What are you working on?";
        else if (avgE > 0.75) msg = `\u26A1 You're in high energy mode. What's the hardest thing on your list right now?`;
        else if (avgE < 0.35) msg = `\u{1F634} Low energy detected. Small task or rest? Reply to log your state.`;
        else msg = `\u{1F3AF} Mid-day check: still on track with your goal? Reply to update AETHER.`;
        await sendTelegram(env.TELEGRAM_CHAT_ID, msg, env);
        return jsonResp({ ok: true, action, sent: msg });
      }
      case "notion_log": {
        if (!env.NOTION_TOKEN || !env.NOTION_DATABASE_ID) {
          return jsonResp({ ok: false, error: "NOTION_TOKEN and NOTION_DATABASE_ID not set" });
        }
        const events = await getRecentEvents(20, env);
        const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
        const todayEv = events.filter((e) => e.timestamp?.startsWith(today));
        const avgE = todayEv.length > 0 ? Math.round(todayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / todayEv.length * 100) : 0;
        const topics = [...new Set(todayEv.map((e) => e.topic).filter(Boolean))].slice(0, 5).join(", ");
        const resp = await fetch("https://api.notion.com/v1/pages", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${env.NOTION_TOKEN}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            parent: { database_id: env.NOTION_DATABASE_ID },
            properties: {
              "Name": { title: [{ text: { content: `AETHER Log \u2014 ${today}` } }] },
              "Date": { date: { start: today } },
              "Energy": { number: avgE },
              "Events": { number: todayEv.length },
              "Topics": { rich_text: [{ text: { content: topics } }] }
            }
          })
        });
        const notionData = await resp.json();
        return jsonResp({ ok: resp.ok, notion_id: notionData.id });
      }
      case "webhook": {
        if (!data.url) return jsonResp({ error: "data.url required" }, 400);
        const state = await getLatestState(env);
        const events = await getRecentEvents(5, env);
        const payload = {
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          state,
          recent_events: events.slice(0, 3),
          ...data.extra
        };
        const resp = await fetch(data.url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        return jsonResp({ ok: resp.ok, status: resp.status });
      }
      case "spotify_flow": {
        const playlistUrl = env.SPOTIFY_FLOW_PLAYLIST || "https://open.spotify.com/playlist/37i9dQZF1DX8Uebhn9wzrS";
        await sendTelegram(
          env.TELEGRAM_CHAT_ID,
          `\u{1F3B5} *Flow playlist*
You entered flow state \u2014 time to focus.
${playlistUrl}`,
          env
        );
        return jsonResp({ ok: true, action, playlist: playlistUrl });
      }
      case "checkin_reminder": {
        const url = "https://learning-bot.pages.dev/checkin.html";
        await sendTelegram(
          env.TELEGRAM_CHAT_ID,
          `\u{1F4CA} *Quick check-in*
How are you right now?
${url}`,
          env
        );
        return jsonResp({ ok: true });
      }
      default:
        return jsonResp({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (e) {
    console.error("[AETHER] Trigger error:", e.message);
    return jsonResp({ error: e.message }, 500);
  }
}
__name(handleTrigger, "handleTrigger");
async function handleGitHubLog(request, env) {
  try {
    const body = await request.json();
    const now = (/* @__PURE__ */ new Date()).toISOString();
    const event = {
      timestamp: now,
      input_type: "github",
      raw_text: `git push: ${body.commit_message}`,
      topic: body.topic || "Coding",
      topics: ["coding", "github", body.repo?.split("/")[1] || "project"],
      sentiment: "positive",
      energy_signal: parseFloat(body.energy_signal) || 0.7,
      stress_signal: 0.15,
      focus_signal: 0.8,
      motivation_signal: 0.75,
      dominant_emotion: "neutral",
      is_study_session: true,
      is_goal_mention: body.commit_message?.toLowerCase().includes("feat") || false,
      is_complaint: false,
      estimated_minutes: Math.min(120, (body.files_changed || 1) * 15),
      summary: `GitHub push: ${body.commit_message?.slice(0, 80)}`,
      github_repo: body.repo,
      github_branch: body.branch,
      files_changed: body.files_changed || 0,
      lines_added: body.additions || 0,
      lines_deleted: body.deletions || 0,
      hour_utc: (/* @__PURE__ */ new Date()).getUTCHours(),
      hour_sin: Math.sin(2 * Math.PI * (/* @__PURE__ */ new Date()).getUTCHours() / 24),
      hour_cos: Math.cos(2 * Math.PI * (/* @__PURE__ */ new Date()).getUTCHours() / 24),
      day_of_week: (/* @__PURE__ */ new Date()).getUTCDay(),
      is_weekend: [0, 6].includes((/* @__PURE__ */ new Date()).getUTCDay())
    };
    await saveEvent(event, env);
    if ((body.files_changed || 0) >= 5 && env.TELEGRAM_CHAT_ID) {
      await sendTelegram(
        env.TELEGRAM_CHAT_ID,
        `\u26A1 *Code logged*
${body.commit_message?.slice(0, 60)}
${body.files_changed} files \xB7 +${body.additions || 0} \u2212${body.deletions || 0}`,
        env
      );
    }
    console.log("[AETHER] GitHub push logged:", body.commit_message?.slice(0, 50));
    return jsonResp({ ok: true, message: "GitHub activity logged to AETHER" });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}
__name(handleGitHubLog, "handleGitHubLog");
async function handleResetData(request, env) {
  try {
    const body = await request.json();
    if (body.confirm !== "RESET_ALL_EVENTS") {
      return jsonResp({ error: "Confirmation required: send confirm: RESET_ALL_EVENTS" }, 400);
    }
    await env.AETHER_KV.put("events:list", JSON.stringify([]));
    await env.AETHER_KV.put("events:count", "0");
    await env.AETHER_KV.put("dashboard:latest", JSON.stringify({
      metrics: { focus: 0, learning: 0, productivity: 0, mood: 0, last_updated: (/* @__PURE__ */ new Date()).toISOString() },
      state: null,
      activity: [],
      timeline: [],
      weekData: [0, 0, 0, 0, 0, 0, 0],
      insights: [{ icon: "\u{1F331}", title: "Fresh start", body: "Clean data logging begins now.", tag: "RESET", tagClass: "tag-ok" }],
      goals: { today: [], week: [] },
      streak: 0
    }));
    console.log("[AETHER] Data reset completed");
    return jsonResp({ ok: true, message: "All events cleared. Fresh start ready." });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}
__name(handleResetData, "handleResetData");
async function handleUpdateDashboard(request, env) {
  try {
    const dash = await request.json();
    await env.AETHER_KV.put("dashboard:latest", JSON.stringify(dash));
    return jsonResp({ ok: true, message: "Dashboard updated from ML pipeline" });
  } catch (e) {
    return jsonResp({ error: e.message }, 500);
  }
}
__name(handleUpdateDashboard, "handleUpdateDashboard");
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
    if (!env.AI) throw new Error("No AI binding");
    const result = await env.AI.run("@cf/meta/llama-3-8b-instruct", {
      messages: [{ role: "user", content: prompt }],
      max_tokens: 400
    });
    const raw = result?.response || "{}";
    let parsed = null;
    const match = raw.match(/\{[\s\S]*?\}/);
    if (match) {
      try {
        parsed = JSON.parse(match[0]);
      } catch {
      }
    }
    if (!parsed || typeof parsed.energy_signal !== "number") {
      console.warn("[AETHER] Llama JSON invalid, using fallback");
      return fallbackNLP(text);
    }
    return parsed;
  } catch (e) {
    console.warn("[AETHER] NLP parse failed, using fallback:", e.message);
    return fallbackNLP(text);
  }
}
__name(nlpParse, "nlpParse");
function fallbackNLP(text) {
  const lower = text.toLowerCase();
  const energyWords = ["excited", "great", "amazing", "productive", "focused", "motivated", "energy"];
  const stressWords = ["stressed", "tired", "overwhelmed", "anxious", "worried", "stuck", "confused"];
  const studyWords = ["learned", "studied", "reading", "course", "practice", "revision", "chapter"];
  const energyScore = energyWords.filter((w) => lower.includes(w)).length / energyWords.length;
  const stressScore = stressWords.filter((w) => lower.includes(w)).length / stressWords.length;
  const isStudy = studyWords.some((w) => lower.includes(w));
  return {
    topic: "general",
    topics: [],
    sentiment: stressScore > 0.2 ? "negative" : energyScore > 0.2 ? "positive" : "neutral",
    energy_signal: Math.min(1, 0.5 + energyScore - stressScore),
    stress_signal: Math.min(1, stressScore * 2),
    focus_signal: 0.5,
    motivation_signal: 0.5,
    dominant_emotion: "neutral",
    is_study_session: isStudy,
    is_goal_mention: lower.includes("goal") || lower.includes("target") || lower.includes("plan"),
    is_complaint: stressScore > 0.3,
    estimated_minutes: null,
    summary: text.slice(0, 80)
  };
}
__name(fallbackNLP, "fallbackNLP");
async function openaiVisionExtract(imageUrl, caption, env) {
  const imgResp = await fetch(imageUrl);
  if (!imgResp.ok) throw new Error("Could not download image");
  const imgArray = [...new Uint8Array(await imgResp.arrayBuffer())];
  if (!env.AI) throw new Error("AI binding missing \u2014 add [ai] to wrangler.toml");
  const prompt = caption ? `Image caption: "${caption}". Describe what you see in this image in English. Extract any visible text, topics, tasks or key information.` : "Describe what you see in this image in English only. List any visible text, objects, activities, or key information.";
  const result = await env.AI.run("@cf/llava-hf/llava-1.5-7b-hf", { image: imgArray, prompt, max_tokens: 512 });
  if (!result?.description) throw new Error("Vision model returned empty result");
  return result.description;
}
__name(openaiVisionExtract, "openaiVisionExtract");
async function whisperTranscribe(audioUrl, env) {
  const audioResponse = await fetch(audioUrl);
  if (!audioResponse.ok) throw new Error("Could not download audio file");
  const audioBuffer = await audioResponse.arrayBuffer();
  if (!env.AI) throw new Error("AI binding missing \u2014 add [ai] to wrangler.toml");
  if (audioBuffer.byteLength > 25 * 1024 * 1024) throw new Error("Audio file too large (max 25MB).");
  const result = await env.AI.run("@cf/openai/whisper", { audio: [...new Uint8Array(audioBuffer)] });
  const transcript = result?.text || result?.transcription || "";
  if (!transcript.trim()) throw new Error("Could not transcribe \u2014 try speaking more clearly.");
  return transcript.trim();
}
__name(whisperTranscribe, "whisperTranscribe");
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
        event_type: "telegram_batch"
      })
    }
  );
  const text = await resp.text();
  console.log("[AETHER] GitHub status:", resp.status);
  console.log("[AETHER] GitHub body:", text);
}
__name(triggerMLPipeline, "triggerMLPipeline");
async function getTelegramFileUrl(fileId, env) {
  const resp = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${fileId}`);
  const data = await resp.json();
  if (!data.ok) throw new Error("Telegram getFile failed: " + JSON.stringify(data));
  return `https://api.telegram.org/file/bot${env.TELEGRAM_BOT_TOKEN}/${data.result.file_path}`;
}
__name(getTelegramFileUrl, "getTelegramFileUrl");
async function sendTelegram(chatId, text, env) {
  try {
    await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
  } catch (e) {
    console.warn("[AETHER] sendTelegram failed:", e.message);
  }
}
__name(sendTelegram, "sendTelegram");
function buildTelegramReply(parsed, inputType, rawText) {
  const icons = { text: "\u{1F4DD}", voice: "\u{1F399}", video_note: "\u{1F3A5}", image: "\u{1F5BC}", document: "\u{1F4C4}", goal: "\u{1F3AF}", mood: "\u{1F60A}", checkin: "\u2705" };
  const icon = icons[inputType] || "\u{1F4E8}";
  const energy = Math.round((parsed.energy_signal || 0.5) * 100);
  const stress = Math.round((parsed.stress_signal || 0.2) * 100);
  const focus = Math.round((parsed.focus_signal || 0.5) * 100);
  const sentiment = parsed.sentiment || "neutral";
  const topic = parsed.topic || "general";
  const summary = parsed.summary || rawText.slice(0, 80);
  let flowLabel;
  if (energy > 80 && stress < 20) flowLabel = "\u{1F7E2} FLOW ZONE";
  else if (energy > 60 && stress < 40) flowLabel = "\u{1F7E1} PRE-FLOW";
  else if (stress > 65) flowLabel = "\u{1F534} HIGH STRESS";
  else if (energy < 25) flowLabel = "\u26AB LOW ENERGY";
  else flowLabel = "\u26AA NOMINAL";
  const moodEmoji = sentiment === "positive" ? "\u{1F60A}" : sentiment === "negative" ? "\u{1F614}" : "\u{1F610}";
  if (inputType === "image") {
    return `\u{1F5BC} *Image logged*

Seen: ${summary}
Topic: ${topic}

\u26A1 ${energy}%  \u{1F624} ${stress}%  \u{1F3AF} ${focus}%  ${flowLabel}`;
  }
  if (inputType === "voice" || inputType === "video_note") {
    return `\u{1F399} *Voice logged*

"_${summary}_"

Topic: ${topic}  ${moodEmoji} ${sentiment}
\u26A1 ${energy}%  \u{1F624} ${stress}%  \u{1F3AF} ${focus}%
${flowLabel}`;
  }
  return `${icon} *Logged* \xB7 ${topic}
${moodEmoji} ${sentiment}  \u26A1 ${energy}%  \u{1F624} ${stress}%  \u{1F3AF} ${focus}%
${flowLabel}
_${summary.slice(0, 100)}_`;
}
__name(buildTelegramReply, "buildTelegramReply");
async function sendMorningBriefing(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const events = await getRecentEvents(env, 50);
  const todayGoal = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);
  const yesterday = /* @__PURE__ */ new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const ydStr = yesterday.toISOString().split("T")[0];
  const ydEvents = events.filter((e) => e.timestamp?.startsWith(ydStr));
  const avgEnergy = ydEvents.length > 0 ? Math.round(ydEvents.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / ydEvents.length * 100) : null;
  const streak = await calculateStreak(events);
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayName = days[(/* @__PURE__ */ new Date()).getDay()];
  let msg = `\u{1F305} *Good morning, Avi!*

\u{1F4C5} ${dayName} \xB7 ${today}
\u{1F525} Streak: ${streak} day${streak !== 1 ? "s" : ""}

`;
  if (avgEnergy !== null) msg += `Yesterday: \u26A1 ${avgEnergy}% energy \xB7 ${ydEvents.length} events logged

`;
  if (todayGoal) msg += `\u{1F3AF} *Today's goal:* ${todayGoal}

`;
  else msg += `\u{1F4A1} Set your goal: /goal [what you want to achieve today]

`;
  if (streak === 0) msg += `_Start your streak today \u2014 just send one message._`;
  else if (streak < 3) msg += `_${streak} days in. Keep the momentum going._`;
  else if (streak < 7) msg += `_${streak} days strong. You're building a habit._`;
  else if (streak < 30) msg += `_${streak} day streak. AETHER is learning your patterns._`;
  else msg += `_${streak} days. The model knows you well now._`;
  await sendTelegram(chatId, msg, env);
}
__name(sendMorningBriefing, "sendMorningBriefing");
async function sendEveningSummary(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const events = await getRecentEvents(100, env);
  const todayEv = events.filter((e) => e.timestamp?.startsWith(today));
  const goal = await env.AETHER_KV.get(`goal:${today}`).catch(() => null);
  if (todayEv.length === 0) {
    await sendTelegram(
      chatId,
      `\u{1F319} *Evening check-in*

No activity logged today, Avi.

Tomorrow: start with one message to AETHER when you wake up.

_Consistency beats intensity._`,
      env
    );
    return;
  }
  const avgEnergy = Math.round(todayEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / todayEv.length * 100);
  const avgStress = Math.round(todayEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / todayEv.length * 100);
  const topics = [...new Set(todayEv.map((e) => e.topic).filter(Boolean))].slice(0, 4);
  const streak = await calculateStreak(events);
  let flowSummary;
  if (avgEnergy > 75 && avgStress < 25) flowSummary = "\u{1F7E2} Strong flow day";
  else if (avgEnergy > 55 && avgStress < 45) flowSummary = "\u{1F7E1} Decent focus day";
  else if (avgStress > 65) flowSummary = "\u{1F534} High stress day \u2014 rest tonight";
  else if (avgEnergy < 30) flowSummary = "\u26AB Low energy day \u2014 sleep early";
  else flowSummary = "\u26AA Normal day";
  let msg = `\u{1F319} *AETHER Daily Summary*

`;
  msg += `\u{1F4CA} ${todayEv.length} events logged
`;
  msg += `\u26A1 Avg energy: ${avgEnergy}%
`;
  msg += `\u{1F624} Avg stress: ${avgStress}%
`;
  msg += `${flowSummary}

`;
  if (topics.length > 0) msg += `\u{1F9E0} Topics: ${topics.join(", ")}
`;
  if (goal) msg += `\u{1F3AF} Goal was: ${goal}
`;
  msg += `\u{1F525} Streak: ${streak} days

`;
  msg += avgEnergy < 40 || avgStress > 60 ? `_Rest well tonight. Recovery is productive._` : `_Good work today. Log your state tomorrow morning to keep AETHER learning._`;
  await sendTelegram(chatId, msg, env);
}
__name(sendEveningSummary, "sendEveningSummary");
async function sendWeeklyReport(env) {
  try {
    const events = await getRecentEvents(500, env);
    const now = /* @__PURE__ */ new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1e3);
    const weekEv = events.filter((e) => new Date(e.timestamp) > weekAgo);
    if (weekEv.length === 0) {
      return sendTelegram(env.TELEGRAM_CHAT_ID, "\u{1F4CA} Weekly report: No events logged this week. Start logging!", env);
    }
    const avgEnergy = weekEv.reduce((s, e) => s + (e.energy_signal || 0.5), 0) / weekEv.length;
    const avgStress = weekEv.reduce((s, e) => s + (e.stress_signal || 0.2), 0) / weekEv.length;
    const byDay = {};
    weekEv.forEach((e) => {
      const d = e.timestamp?.split("T")[0];
      if (!byDay[d]) byDay[d] = [];
      byDay[d].push(e.energy_signal || 0.5);
    });
    const dayAvgs = Object.entries(byDay).map(([d, vals]) => ({ d, avg: vals.reduce((s, v) => s + v, 0) / vals.length }));
    const bestDay = dayAvgs.sort((a, b) => b.avg - a.avg)[0];
    const worstDay = dayAvgs[dayAvgs.length - 1];
    const topicCount = {};
    weekEv.forEach((e) => {
      if (e.topic) topicCount[e.topic] = (topicCount[e.topic] || 0) + 1;
    });
    const topTopics = Object.entries(topicCount).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([t]) => t).join(", ") || "none";
    const githubCount = weekEv.filter((e) => e.input_type === "github").length;
    const healthCount = weekEv.filter((e) => e.input_type === "health").length;
    const financeCount = weekEv.filter((e) => e.input_type === "finance").length;
    const careerCount = weekEv.filter((e) => e.input_type === "career").length;
    const streak = await calculateStreak(events);
    const energyBar = "\u2588".repeat(Math.round(avgEnergy * 10)) + "\u2591".repeat(10 - Math.round(avgEnergy * 10));
    const stressBar = "\u2588".repeat(Math.round(avgStress * 10)) + "\u2591".repeat(10 - Math.round(avgStress * 10));
    const msg = `\u{1F4CA} *AETHER Weekly Report*
Week of ${weekAgo.toLocaleDateString("en-IN")}

*Overview*
Events logged: ${weekEv.length}
Current streak: ${streak} days

*Energy*
${energyBar} ${Math.round(avgEnergy * 100)}%
Best day: ${bestDay?.d || "n/a"}
Worst day: ${worstDay?.d || "n/a"}

*Stress*
${stressBar} ${Math.round(avgStress * 100)}%

*Top topics*
${topTopics}

*Activity breakdown*
\u{1F4BB} Code pushes: ${githubCount}
\u{1F4AA} Health logs: ${healthCount}
\u{1F4B0} Finance logs: ${financeCount}
\u{1F4BC} Career logs: ${careerCount}

*Next week focus*
${avgEnergy < 0.5 ? "\u26A1 Energy is low \u2014 prioritise sleep and exercise" : avgStress > 0.5 ? "\u{1F9D8} Stress is high \u2014 schedule recovery time" : "\u{1F680} Good baseline \u2014 push harder on goals"}

Keep logging. AETHER learns from every entry. \u{1F916}`;
    return sendTelegram(env.TELEGRAM_CHAT_ID, msg, env);
  } catch (e) {
    console.error("[AETHER] Weekly report failed:", e.message);
  }
}
__name(sendWeeklyReport, "sendWeeklyReport");
async function middayNudge(env) {
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!chatId) return;
  const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
  const events = await getRecentEvents(20, env);
  const todayEv = events.filter((e) => e.timestamp?.startsWith(today) && e.input_type !== "checkin");
  if (todayEv.length === 0) {
    await sendTelegram(
      chatId,
      `\u{1F31E} *Midday check*

No activity logged yet today.
What are you working on?

Just reply or use /goal to set your focus.`,
      env
    );
  }
}
__name(middayNudge, "middayNudge");
async function calculateStreak(events) {
  const days = new Set(events.map((e) => e.timestamp?.split("T")[0]).filter(Boolean));
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = /* @__PURE__ */ new Date();
    d.setDate(d.getDate() - i);
    const ds = d.toISOString().split("T")[0];
    if (days.has(ds)) streak++;
    else if (i > 0) break;
  }
  return streak;
}
__name(calculateStreak, "calculateStreak");
async function encryptText(text, env) {
  const keyMaterial = env.ENCRYPT_KEY || "AETHER_DEFAULT_KEY_CHANGE_IN_PROD";
  try {
    const keyData = new TextEncoder().encode(keyMaterial.padEnd(32, "0").slice(0, 32));
    const key = await crypto.subtle.importKey("raw", keyData, { name: "AES-GCM" }, false, ["encrypt"]);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const cipher = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoded);
    const combined = new Uint8Array(iv.length + cipher.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(cipher), iv.length);
    return btoa(String.fromCharCode(...combined));
  } catch (e) {
    return "[UNENCRYPTED]:" + text;
  }
}
__name(encryptText, "encryptText");
async function saveEvent(event, env) {
  if (!env.AETHER_KV) {
    console.warn("[AETHER] KV not available, event not saved");
    return;
  }
  try {
    const raw = await env.AETHER_KV.get("events:list");
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
    await env.AETHER_KV.put("events:list", JSON.stringify(events));
    await env.AETHER_KV.put("events:count", String(events.length));
    const realTypes = ["text", "voice", "image", "document", "video_note"];
    if (realTypes.includes(event.input_type)) {
      const realCount = events.filter((e) => realTypes.includes(e.input_type)).length;
      if (realCount >= 3 && realCount % 3 === 0 && env.GITHUB_TOKEN) {
        triggerMLPipeline(env).catch(
          (e) => console.warn("[AETHER] ML trigger failed:", e.message)
        );
      }
    }
  } catch (e) {
    console.error("[AETHER] saveEvent failed:", e.message);
  }
}
__name(saveEvent, "saveEvent");
async function getEventCount(env) {
  if (!env.AETHER_KV) return 0;
  try {
    const count = await env.AETHER_KV.get("events:count");
    return parseInt(count || "0");
  } catch {
    return 0;
  }
}
__name(getEventCount, "getEventCount");
async function getLatestState(env) {
  if (!env.AETHER_KV) return null;
  try {
    const today = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
    const raw = await env.AETHER_KV.get(`state:${today}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
__name(getLatestState, "getLatestState");
async function refreshDashboardFromState(stateVector, env) {
  if (!env.AETHER_KV) return;
  try {
    const existing = await env.AETHER_KV.get("dashboard:latest");
    const dash = existing ? JSON.parse(existing) : defaultDashboard();
    dash.metrics.focus = Math.round((stateVector.energy || 0.5) * 100);
    dash.metrics.mood = Math.round((1 - (stateVector.stress || 0.2)) * 100);
    dash.metrics.productivity = Math.round((stateVector.flow_prob || 0.3) * 100);
    dash.metrics.last_updated = (/* @__PURE__ */ new Date()).toISOString();
    dash.state = stateVector;
    await env.AETHER_KV.put("dashboard:latest", JSON.stringify(dash));
  } catch (e) {
    console.warn("[AETHER] refreshDashboard failed:", e.message);
  }
}
__name(refreshDashboardFromState, "refreshDashboardFromState");
function defaultDashboard() {
  return {
    metrics: { focus: 0, learning: 0, productivity: 0, mood: 0, last_updated: null },
    state: null,
    activity: [],
    timeline: [],
    goals: { today: [], week: [] },
    insights: [{ icon: "\u{1F331}", title: "Fresh Start", body: "Send messages to your Telegram bot to start logging. Every message trains your model.", tag: "START", tagClass: "tag-ok" }],
    streak: 0,
    weekData: [0, 0, 0, 0, 0, 0, 0],
    inputCounts: {},
    hourlyData: new Array(24).fill(0),
    todayCount: 0,
    flowLabel: "NOMINAL",
    pipeline: [
      { icon: "\u{1F4E5}", name: "pull_events.py", sub: "KV \u2192 events.csv", status: "READY", cls: "ps-ok" },
      { icon: "\u{1F9F9}", name: "data_cleaner.py", sub: "Remove bad events", status: "READY", cls: "ps-ok" },
      { icon: "\u{1F3CB}", name: "train_models.py", sub: "RandomForest + GBM", status: "WAITING", cls: "ps-warn" },
      { icon: "\u{1F52E}", name: "predict.py", sub: "Flow + peak hour", status: "WAITING", cls: "ps-warn" },
      { icon: "\u{1F4E4}", name: "push_dashboard.py", sub: "Predictions \u2192 KV", status: "READY", cls: "ps-ok" }
    ]
  };
}
__name(defaultDashboard, "defaultDashboard");

// ../../.nvm/versions/node/v20.20.1/lib/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../.nvm/versions/node/v20.20.1/lib/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-1sw8iI/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = worker_default;

// ../../.nvm/versions/node/v20.20.1/lib/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-1sw8iI/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class ___Facade_ScheduledController__ {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  static {
    __name(this, "__Facade_ScheduledController__");
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof ___Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = /* @__PURE__ */ __name((request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    }, "#fetchDispatcher");
    #dispatcher = /* @__PURE__ */ __name((type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    }, "#dispatcher");
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=worker.js.map
