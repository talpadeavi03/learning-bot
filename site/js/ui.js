// CLOCK
const startTime = Date.now();
function tick() {
  const n = new Date();
  const c = document.getElementById('tbclk'); if (c) c.textContent = n.toTimeString().slice(0, 8);
  const d = document.getElementById('date'); if (d) d.textContent = n.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const up = Math.floor((Date.now() - startTime) / 1000);
  const h = String(Math.floor(up / 3600)).padStart(2, '0'), m = String(Math.floor(up % 3600 / 60)).padStart(2, '0'), s = String(up % 60).padStart(2, '0');
  const el = document.getElementById('jp-uptime'); if (el) el.textContent = `${h}:${m}:${s}`;
}
tick(); setInterval(tick, 1000);

// LOADER
const bootMsgs = ['Connecting to worker...', 'Loading ML pipeline...', 'Syncing KV store...', 'Calibrating JARVIS core...', 'System ready.'];
let mi = 0; const bmEl = document.getElementById('bootMsg');
function bootAnim() {
  if (mi < bootMsgs.length) { if (bmEl) bmEl.textContent = bootMsgs[mi++]; setTimeout(bootAnim, 420) }
  else setTimeout(() => {
    document.getElementById('loader').classList.add('gone');
    animateBars(); initCharts(); initWaveform(); initGraphCanvas();
    setTimeout(() => showAchievement('System Boot Complete', '+500 XP'), 1000);
  }, 300);
}
bootAnim();

// ACHIEVEMENT
let achT = null;
function showAchievement(name, pts) {
  const el = document.getElementById('achievement');
  document.getElementById('ach-name').textContent = name;
  document.getElementById('ach-pts').textContent = pts;
  el.classList.add('show'); clearTimeout(achT);
  achT = setTimeout(() => el.classList.remove('show'), 3500);
}

// COUNT-UP
function countUp(id, target) {
  let v = 0; const el = document.getElementById(id); if (!el) return;
  const t = setInterval(() => { v = Math.min(v + Math.ceil(target / 40), target); el.textContent = v; if (v >= target) clearInterval(t) }, 28);
}
// Initial countUp with zeros — will be overridden by loadDashboard() with live data
setTimeout(() => { countUp('wSessions', 0); countUp('wGoals', 0); countUp('wStreak', 0); countUp('wScore', 0) }, 700);
const pEl = document.getElementById('powerNum');
if (pEl) pEl.textContent = '—';

// BARS
function animateBars() {
  [['focusBar', '82'], ['moodBar', '68'], ['sleepBar', '74'], ['prodBar', '91'],
  ['infra-bar', '100'], ['ingest-bar', '90'], ['ui-bar', '85'], ['ml-bar', '70'],
  ['ai-bar', '50'], ['sec-bar', '10'], ['apk-bar', '20']
  ].forEach(([id, w]) => { const el = document.getElementById(id); if (el) setTimeout(() => el.style.width = w + '%', 200) });
}

// CHARTS
