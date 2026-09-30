// VIEW SWITCHING
const bcNames = { home: 'Home', learning: 'Learning', jobs: 'Jobs' };
function switchView(name, el) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('on'));
  document.querySelectorAll('#sb .sbi').forEach(t => t.classList.remove('act'));
  document.querySelectorAll('#page-tabs .ptab').forEach(t => t.classList.remove('on'));
  document.getElementById('view-' + name).classList.add('on');
  // Highlight sidebar item
  const navEl = document.getElementById('nav-' + name); if (navEl) navEl.classList.add('act');
  // Highlight page tab
  const ptabEl = document.getElementById('ptab-' + name); if (ptabEl) ptabEl.classList.add('on');
  const bc = document.getElementById('tb-bc'); if (bc) bc.textContent = bcNames[name] || name;
  if (name === 'learning') {
    setTimeout(() => {
      animateBars();
      initCharts();
      initWaveform();
      initGraphCanvas();
    }, 50);
  } else if (name === 'jobs') {
    if (typeof renderJobs === 'function') renderJobs();
  }
}
function showDoc(name, tab) {
  document.querySelectorAll('.doc-frame').forEach(d => d.classList.remove('on'));
  document.getElementById('doc-' + name).classList.add('on');
  document.querySelectorAll('.dtab').forEach(t => t.classList.remove('on'));
  tab.classList.add('on');
}

// INTERACTIVE
function setMood(btn) { document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('sel')); btn.classList.add('sel'); showAchievement('Mood Updated', '+10 XP') }
function toggleGoal(check) {
  check.classList.toggle('done'); check.textContent = check.classList.contains('done') ? '✓' : '';
  const txt = check.nextElementSibling; if (txt) txt.classList.toggle('done');
  if (check.classList.contains('done')) showAchievement('Quest Complete', '+100 XP');
}

// PASSWORD (hash-based — password is NOT stored in plaintext)
let AETHER_PASSKEY = null;
function openGate() { document.getElementById('pw-gate').classList.add('show') }
function closeGate() { document.getElementById('pw-gate').classList.remove('show') }

async function hashPassword(pw) {
  const data = new TextEncoder().encode(pw);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// SHA-256 of the passkey (change this hash to change the password)
// To generate: echo -n "yourpassword" | sha256sum
const PASS_HASH = '5e17d8671e68b2f5a0d6c1dbbd04b5e50168b0cf9adcbee8fc4fc7ad637e3285';

async function checkPassword() {
  const v = document.getElementById('pw-input').value;
  const err = document.getElementById('pw-error');
  const inputHash = await hashPassword(v);
  if (inputHash === PASS_HASH) {
    AETHER_PASSKEY = v;
    closeGate();
    loadNeuralMemory();
  } else {
    err.style.opacity = '1'; setTimeout(() => err.style.opacity = '0', 2000);
  }
}
document.addEventListener('DOMContentLoaded', () => { const inp = document.getElementById('pw-input'); if (inp) inp.addEventListener('keydown', e => { if (e.key === 'Enter') checkPassword() }) });

// DECRYPTION ENGINE
async function decryptText(base64Str, passkey) {
  if(base64Str.startsWith('[UNENCRYPTED]:')) return base64Str.substring(14);
  try {
    const bText = atob(base64Str);
    const combined = new Uint8Array(bText.length);
    for(let i=0; i<bText.length; i++) combined[i] = bText.charCodeAt(i);
    const iv = combined.slice(0, 12);
    const data = combined.slice(12);
    
    const keyData = new Uint8Array(32);
    const passEncoded = new TextEncoder().encode(passkey);
    keyData.set(passEncoded.slice(0, Math.min(passEncoded.length, 32)));
    
    const key = await crypto.subtle.importKey('raw', keyData, { name: 'AES-GCM' }, false, ['decrypt']);
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
    return new TextDecoder().decode(decrypted);
  } catch(e) {
    return null;
  }
}

// CHAT
let chatOpen = false;
async function loadTabs() {
  try {
    const baseUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : '';
    const res = await fetch(baseUrl + "/tabs");
    if (!res.ok) return;
    const data = await res.json();
    const tabs = data.tabs || [];
    const container = document.getElementById("dynamicTabs");
    if (!container) return;
    container.innerHTML = "";
    tabs.forEach(tab => {
      const div = document.createElement("div");
      div.className = "tab " + (tab.type || "");
      div.innerText = tab.title || "Tab";
      container.appendChild(div);
    });
  } catch (err) {
    console.error("Tab load error", err);
  }
}

async function loadNeuralMemory() {
  try {
    const baseUrl = typeof WORKER_URL !== 'undefined' ? WORKER_URL : '';
    const res = await fetch(baseUrl + "/events");
    if (!res.ok) return;
    const data = await res.json();
    const events = data.events || [];
    const feed = document.getElementById("neuralMemoryFeed");
    if (!feed) return;
    
    if (events.length === 0) {
      feed.innerHTML = '<div style="font-size:12px; color:var(--text2); padding:10px 0;">No neural memory recorded yet.</div>';
      return;
    }
    
    feed.innerHTML = "";
    
    // Ensure newest first
    let sorted = [...events];
    if (sorted.length > 1 && new Date(sorted[0].timestamp) < new Date(sorted[sorted.length-1].timestamp)) {
       sorted.reverse();
    }
    
    const latestEvents = sorted.slice(0, 15);
    
    for (const e of latestEvents) {
      const type = e.input_type || 'unknown';
      let text = e.summary || e.raw_text || e.topic || "Unknown signal";
      
      if(e.encrypted) {
         if(AETHER_PASSKEY) {
           const dec = await decryptText(text, AETHER_PASSKEY);
           text = dec ? dec : "🔒 [DECRYPTION FAILED]";
         } else {
           text = text.startsWith("[UNENCRYPTED]") ? text.replace("[UNENCRYPTED]:", "") : "🔒 [ENCRYPTED SIGNAL] Decrypt below.";
         }
      }
      
      let timeDisplay = e.timestamp ? new Date(e.timestamp).toLocaleString() : 'Unknown Time';
      
      const item = document.createElement("div");
      item.className = "ntl-item";
      if (!AETHER_PASSKEY && text.includes("Decrypt below")) {
         item.setAttribute("onclick", "openGate()");
         item.style.cursor = "pointer";
      }
      item.innerHTML = `
        <div class="ntl-dot"></div>
        <div>
          <div class="ntl-txt">[${type.toUpperCase()}] ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}</div>
          <div class="ntl-time">${timeDisplay}</div>
        </div>
      `;
      feed.appendChild(item);
    }
  } catch(e) { console.error("Neural memory init failed", e); }
}

setInterval(loadTabs, 10000);
setTimeout(loadTabs, 1000);
// Only run neuralMemory poll if element exists
if (document.getElementById('neuralMemoryFeed')) {
  setInterval(loadNeuralMemory, 10000);
  setTimeout(loadNeuralMemory, 1000);
}

function openChat() { if (chatOpen) return; chatOpen = true; document.getElementById('chatPage').classList.add('open'); setTimeout(() => { initArcReactor(); document.getElementById('chatIn').focus() }, 100) }
function closeChat() { if (!chatOpen) return; chatOpen = false; stopSpeaking(); document.getElementById('chatPage').classList.remove('open') }
function quickSend(t) { openChat(); setTimeout(() => { document.getElementById('chatIn').value = t; sendChat() }, chatOpen ? 0 : 650) }
const hist = [];
async function sendChat() {
  const inp = document.getElementById('chatIn'); const txt = inp.value.trim(); if (!txt) return;
  inp.value = ''; addMsg('user', txt); hist.push({ role: 'user', content: txt });
  document.getElementById('thinking').classList.remove('hidden');
  document.getElementById('sendBtn').disabled = true; startSpeaking();
  const engine = (document.getElementById('aiEngine') || {}).value || 'hybrid';
  const el = document.getElementById('jp-engine'); if (el) el.textContent = engine;
  try {
    const r = await fetch(WORKER_URL + '/chat', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: txt, history: hist, metrics: D.metrics, activity: D.activity, goals: D.goals.today, engine })
    });
    const data = await r.json(); const reply = data.reply || data.error || 'Neural pathway disrupted, sir.';
    hist.push({ role: 'assistant', content: reply });
    document.getElementById('thinking').classList.add('hidden'); document.getElementById('sendBtn').disabled = false; typeMsg(reply);
  } catch (err) {
    stopSpeaking(); document.getElementById('thinking').classList.add('hidden'); document.getElementById('sendBtn').disabled = false;
    addMsg('ai', 'Worker offline. Connection disrupted.');
  }
}
function addMsg(role, text) {
  const box = document.getElementById('chatMsgs'); const el = document.createElement('div'); el.className = 'msg ' + role;
  el.innerHTML = `<div class="mlbl">${role === 'user' ? 'You' : 'J.A.R.V.I.S'}</div>${text}`;
  box.appendChild(el); box.scrollTop = box.scrollHeight;
}
function typeMsg(text) {
  const box = document.getElementById('chatMsgs'); const el = document.createElement('div'); el.className = 'msg ai';
  const lb = document.createElement('div'); lb.className = 'mlbl'; lb.textContent = 'J.A.R.V.I.S';
  const sp = document.createElement('span'); const cur2 = document.createElement('span');
  cur2.textContent = '▌'; cur2.style.animation = 'blink .5s infinite';
  el.appendChild(lb); el.appendChild(sp); el.appendChild(cur2); box.appendChild(el); let i = 0;
  function type() {
    if (i < text.length) { sp.textContent += text[i++]; box.scrollTop = box.scrollHeight; arcAudioLevel = 0.2 + Math.random() * .5; setTimeout(type, 12) }
    else { cur2.remove(); stopSpeaking(); showAchievement('JARVIS Responded', '+20 XP') }
  }
  type();
}

// WORKER HEALTH
async function checkWorker() {
  try {
    const r = await fetch(WORKER_URL + '/health', { signal: AbortSignal.timeout(5000) });
    if (r.ok) {
      const dot = document.getElementById('wsdot'); if (dot) dot.classList.add('on');
      const txt = document.getElementById('wstext'); if (txt) txt.textContent = 'API Online';
      const inl = document.getElementById('wsInline'); if (inl) inl.innerHTML = '<span class="tag tg">🟢 API Online</span>';
    }
  } catch (e) {
    const txt = document.getElementById('wstext'); if (txt) txt.textContent = 'Offline';
    const inl = document.getElementById('wsInline'); if (inl) inl.innerHTML = '<span class="tag tr">🔴 Offline</span>';
  }
}
setTimeout(checkWorker, 2500);
window.addEventListener('resize', () => { if (chatOpen) initArcReactor() });



// ─── PRIORITY QUEUE ───────────────────────────────────────────────
async function loadPriorities() {
  try {
    const res = await fetch(WORKER_URL + '/priorities');
    const data = await res.json();
    renderPriorities(data);
  } catch(e) { console.warn('Priority load failed', e); }
}

function renderPriorities(list) {
  const el = document.getElementById('priority-list');
  const empty = document.getElementById('priority-empty');
  const count = document.getElementById('priority-count');
  if (!el) return;

  const pending = list.filter(p => !p.done);
  const done = list.filter(p => p.done);

  count.textContent = `${pending.length} pending · ${done.length} done`;

  if (list.length === 0) {
    empty.style.display = 'block';
    el.innerHTML = '';
    el.appendChild(empty);
    return;
  }
  empty.style.display = 'none';

  el.innerHTML = pending.map(p => `
    <div id="pri-${p.id}" style="display:flex;align-items:center;gap:10px;padding:10px 12px;border-radius:7px;background:var(--red-bg);border:1px solid rgba(212,76,71,.18);transition:opacity .3s">
      <button onclick="markPriorityDone(${p.id})" title="Mark done"
        style="width:20px;height:20px;border-radius:50%;border:2px solid var(--red);background:none;cursor:pointer;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--red)">○</button>
      <span style="flex:1;font-size:13.5px;font-weight:600;color:var(--text)">${p.text}</span>
      <span style="font-size:10.5px;color:var(--red);font-weight:700;text-transform:uppercase;letter-spacing:.04em">MUST DO</span>
    </div>
  `).join('') + (done.length > 0 ? `
    <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
      ${done.slice(0,3).map(p => `
        <div style="display:flex;align-items:center;gap:10px;padding:6px 12px;opacity:.5">
          <span style="color:var(--green);font-size:14px">✓</span>
          <span style="text-decoration:line-through;font-size:13px;color:var(--text2)">${p.text}</span>
        </div>
      `).join('')}
    </div>
  ` : '');
}

async function addPriority() {
  const input = document.getElementById('priority-input');
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  try {
    const res = await fetch(WORKER_URL + '/priorities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text })
    });
    const data = await res.json();
    if (data.ok) {
      showAchievement('Priority Locked In', '🔴 Must-do added');
      loadPriorities();
    }
  } catch(e) { console.warn('Add priority failed', e); }
}

async function markPriorityDone(id) {
  const el = document.getElementById('pri-' + id);
  if (el) el.style.opacity = '0.3';
  try {
    await fetch(WORKER_URL + '/priorities/done', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id })
    });
    showAchievement('Task Crushed! 💪', '+50 XP');
    setTimeout(loadPriorities, 400);
  } catch(e) { console.warn('Done priority failed', e); }
}

// Load on startup
loadPriorities();

// ═══════════════════════════════════════════════════════════════
// BUG-05 FIX: LIVE DASHBOARD DATA LOADER
// Fetches from /dashboard API and populates all stat elements
// ═══════════════════════════════════════════════════════════════

let dashboardData = null;

async function loadDashboard() {
  try {
    const res = await fetch(WORKER_URL + '/dashboard', { signal: AbortSignal.timeout(6000) });
    if (res.ok) {
      dashboardData = await res.json();
      populateDashboard(dashboardData);
      return;
    }
  } catch (e) {
    console.warn('[AETHER] Remote dashboard fetch failed, trying local data:', e.message);
  }

  // Local fallback to static pipeline data
  try {
    const localRes = await fetch('data/dashboard.json');
    if (localRes.ok) {
      dashboardData = await localRes.json();
      try {
        const insRes = await fetch('data/insights.json');
        if (insRes.ok) {
          const insData = await insRes.json();
          if (insData.insights) dashboardData.insights = insData.insights;
        }
      } catch (_) {}
      try {
        const planRes = await fetch('data/daily_plan.json');
        if (planRes.ok) {
          const planData = await planRes.json();
          if (planData.plan && planData.plan[0]) {
            dashboardData.goals = { today: planData.plan[0] };
          }
        }
      } catch (_) {}
      populateDashboard(dashboardData);
    }
  } catch (e) {
    console.warn('[AETHER] Local dashboard fallback failed:', e.message);
  }
}

function setEl(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function populateDashboard(d) {
  if (!d) return;

  // ── Energy, Focus, Stress Normalized ──
  const energyVal = d.metrics?.energy ?? d.metrics?.learning ?? (d.avg_energy !== undefined ? Math.round(d.avg_energy * (d.avg_energy <= 1 ? 100 : 1)) : 65);
  const focusVal = d.metrics?.focus ?? (d.avg_focus !== undefined ? Math.round(d.avg_focus * (d.avg_focus <= 1 ? 100 : 1)) : 70);
  const stressVal = d.metrics?.stress ?? (d.avg_stress !== undefined ? Math.round(d.avg_stress * (d.avg_stress <= 1 ? 100 : 1)) : 15);

  setEl('sd-energy', energyVal + '%');
  setEl('sd-focus', focusVal + '%');
  setEl('sd-stress', stressVal + '%');
  setEl('sd-events', d.metrics?.total_events ?? d.today_events_count ?? d.metrics?.events ?? d.timeline?.length ?? '10');
  setEl('sd-streak', (d.streak ?? 14) + 'd');

  // Count wins from today's events or insights
  const winsCount = (d.timeline || []).filter(t => t.event?.includes('win')).length;
  setEl('sd-wins', winsCount || (d.insights || []).filter(i => i.tagClass === 'tag-ok').length || '3');

  // ── Flow State ──
  const flowEl = document.getElementById('flow-label');
  if (flowEl) {
    const flowText = d.state?.flow_class || d.flowLabel || d.flow_state || d.metrics?.flowLabel || 'PRE-FLOW';
    flowEl.textContent = flowText;
    flowEl.className = 'tag ' + (flowText === 'FLOW' ? 'tg' : (flowText === 'ANXIETY' ? 'tr' : (flowText === 'RECOVERY' ? 'ty' : 'tb')));
  }
  const flowProbEl = document.getElementById('flow-prob');
  if (flowProbEl) {
    const probVal = d.flow_probability !== undefined ? Math.round(d.flow_probability * 100) : (d.metrics?.flowProb ?? 85);
    flowProbEl.textContent = probVal + '% conf';
  }

  // ── Solo Leveling Stats ──
  const level = Math.floor((energyVal + focusVal) / 20) + 1;
  const xp = (energyVal + focusVal) * 10;
  setEl('sl-level', 'LV ' + level);
  setEl('sl-xp', xp + ' XP');
  setEl('powerNum', xp);
  const slStats = document.getElementById('sl-stats');
  if (slStats) {
    slStats.innerHTML = `
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>INT</span><span>${Math.round(focusVal / 10)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>VIT</span><span>${Math.round(energyVal / 10)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12.5px;margin-bottom:4px"><span>AGI</span><span>${Math.round((100 - stressVal) / 10)}</span></div>
      <div style="display:flex;justify-content:space-between;font-size:12.5px"><span>SEN</span><span>${Math.round((d.metrics?.mood || 80) / 10)}</span></div>
    `;
  }

  // ── Life Dimensions ──
  const lifeDims = document.getElementById('life-dims');
  if (lifeDims) {
    if (d.activity && d.activity.length > 0) {
      lifeDims.innerHTML = d.activity.map(a => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;font-weight:600">${a.topic}</span>
          <span style="font-size:12px;color:var(--text2)">${a.minutes}min</span>
        </div>
      `).join('');
    } else if (d.topics && Object.keys(d.topics).length > 0) {
      lifeDims.innerHTML = Object.entries(d.topics).map(([topic, count]) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--border)">
          <span style="font-size:13px;font-weight:600">${topic}</span>
          <span style="font-size:12px;color:var(--text2)">${count} sessions</span>
        </div>
      `).join('');
    }
  }

  // ── Insights ──
  const insightsPanel = document.getElementById('insights-panel');
  if (insightsPanel && d.insights && d.insights.length > 0) {
    insightsPanel.innerHTML = d.insights.map(i => {
      const isStr = typeof i === 'string';
      const title = isStr ? 'Daily Intel' : (i.title || 'Insight');
      const body = isStr ? i : (i.body || i.text || '');
      const icon = isStr ? '💡' : (i.icon || '💡');
      const tag = isStr ? 'INTEL' : (i.tag || 'SYSTEM');
      const tagClass = isStr ? 'tg' : (i.tagClass || 'tg');
      return `
        <div style="padding:8px 10px;border-radius:6px;background:var(--card);border:1px solid var(--border);margin-bottom:6px">
          <div style="display:flex;align-items:center;gap:6px;margin-bottom:3px">
            <span>${icon}</span>
            <span style="font-weight:600;font-size:12.5px">${title}</span>
            <span class="tag ${tagClass}" style="margin-left:auto;font-size:10px">${tag}</span>
          </div>
          <div style="font-size:12px;color:var(--text2)">${body}</div>
        </div>
      `;
    }).join('');
  }

  // ── Negatives (What's Holding You Back) & Wins ──
  const negPanel = document.getElementById('negatives-panel');
  if (negPanel) {
    const negs = (d.insights || []).filter(i => {
      if (typeof i === 'string') {
        const lower = i.toLowerCase();
        return lower.includes('distraction') || lower.includes('diffuse') || lower.includes('stress') || lower.includes('friction') || lower.includes('fatigue');
      }
      return i.tagClass === 'tag-med' || i.tagClass === 'tag-warn' || i.tag === 'ACTION' || i.tag === 'WARNING';
    });
    if (negs.length > 0) {
      negPanel.innerHTML = negs.map(n => `
        <div style="font-size:12.5px;color:var(--text);margin-bottom:6px;display:flex;gap:6px">
          <span>⚠️</span><span>${typeof n === 'string' ? n : (n.body || n.title)}</span>
        </div>
      `).join('');
    } else {
      negPanel.innerHTML = '<div style="font-size:12.5px;color:var(--text2)">Zero friction markers detected. All systems green.</div>';
    }
  }

  const winsPanel = document.getElementById('wins-panel');
  if (winsPanel) {
    const wins = (d.insights || []).filter(i => {
      if (typeof i === 'string') {
        const lower = i.toLowerCase();
        return lower.includes('great') || lower.includes('calm') || lower.includes('win') || lower.includes('active') || lower.includes('momentum');
      }
      return i.tagClass === 'tag-ok' || i.tag === 'PATTERN' || i.tag === 'WIN';
    });
    if (wins.length > 0) {
      winsPanel.innerHTML = wins.map(w => `
        <div style="font-size:12.5px;color:var(--text);margin-bottom:6px;display:flex;gap:6px">
          <span>🏆</span><span>${typeof w === 'string' ? w : (w.body || w.title)}</span>
        </div>
      `).join('');
    } else {
      winsPanel.innerHTML = '<div style="font-size:12.5px;color:var(--text2)">Consistent active streak logged today.</div>';
    }
  }

  // ── Pipeline Status Tags ──
  const trainSt = document.getElementById('train-status');
  const predSt = document.getElementById('predict-status');
  if (trainSt) { trainSt.textContent = 'OK'; trainSt.className = 'tag tg'; }
  if (predSt) { predSt.textContent = 'OK'; predSt.className = 'tag tg'; }

  // ── Goals ──
  if (d.goals) {
    const todayGoalEl = document.getElementById('today-goal');
    if (todayGoalEl && d.goals.today) {
      todayGoalEl.textContent = typeof d.goals.today === 'string' ? d.goals.today : (d.goals.today.text || 'Focus on high-priority sprint');
    }
  }

  // ── Weekly Chart Data ──
  const weekArr = d.weekData || d.week_energy;
  if (weekArr && typeof D !== 'undefined') {
    D.weekly = weekArr.map(v => typeof v === 'number' && v <= 1 ? Math.round(v * 8) : v);
  }

  // ── Timeline ──
  const timelineEl = document.getElementById('timeline-feed');
  if (timelineEl) {
    if (d.timeline && d.timeline.length > 0) {
      timelineEl.innerHTML = d.timeline.map(t => `
        <div style="display:flex;align-items:flex-start;gap:8px;padding:5px 0">
          <span style="font-size:11px;color:var(--text2);min-width:42px;font-family:monospace">${t.time || 'Today'}</span>
          <span style="font-size:12.5px;color:var(--text)">${t.event || t.summary || 'Logged activity'}</span>
        </div>
      `).join('');
    } else {
      timelineEl.innerHTML = '<div style="font-size:12px;color:var(--text2);padding:6px 0">Active logging session recorded today.</div>';
    }
  }

  // ── Summary counts ──
  setEl('wSessions', d.metrics?.studySessions ?? d.metrics?.total_events ?? d.today_events_count ?? 10);
  setEl('wStreak', d.streak ?? 14);
  setEl('wScore', Math.min(100, Math.round((energyVal + focusVal) * 0.65)));
  setEl('wGoals', d.goals?.completed ?? d.goals_completed ?? 8);
}

// Load dashboard on page load and refresh every 30s
setTimeout(loadDashboard, 500);
setInterval(loadDashboard, 30000);
