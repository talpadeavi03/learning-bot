let chartsInit = false;
function initCharts() {
  if (chartsInit) return; chartsInit = true;
  const wc = document.getElementById('weekChart');
  if (wc) new Chart(wc, {
    type: 'bar', data: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{
        data: D.weekly,
        backgroundColor: D.weekly.map(v => v > 6 ? 'rgba(45,159,61,.55)' : v > 5 ? 'rgba(45,159,61,.3)' : 'rgba(45,159,61,.14)'),
        borderColor: 'rgba(45,159,61,.35)', borderWidth: 1, borderRadius: 5
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', titleColor: '#37352f', bodyColor: '#787774', borderColor: 'rgba(55,53,47,.1)', borderWidth: 1, callbacks: { label: c => c.parsed.y + 'h deep work' } } },
      scales: {
        x: { ticks: { color: '#787774', font: { family: 'Plus Jakarta Sans', size: 11 } }, grid: { color: 'rgba(55,53,47,.05)' } },
        y: { ticks: { color: '#787774', font: { family: 'Plus Jakarta Sans', size: 11 } }, grid: { color: 'rgba(55,53,47,.05)' }, max: 8 }
      }
    }
  });
  const dc = document.getElementById('donutChart');
  if (dc) new Chart(dc, {
    type: 'doughnut', data: {
      labels: ['Study', 'Code', 'Ops', 'Other'],
      datasets: [{
        data: D.donut || [42, 28, 18, 12],
        backgroundColor: ['rgba(45,159,61,.68)', 'rgba(45,159,61,.44)', 'rgba(45,159,61,.25)', 'rgba(45,159,61,.11)'],
        borderColor: ['rgba(45,159,61,.8)', 'rgba(45,159,61,.5)', 'rgba(45,159,61,.3)', 'rgba(45,159,61,.15)'], borderWidth: 1
      }]
    },
    options: { responsive: true, cutout: '72%', plugins: { legend: { display: false }, tooltip: { backgroundColor: '#fff', bodyColor: '#37352f', borderColor: 'rgba(55,53,47,.1)', borderWidth: 1 } } }
  });
}

// WAVEFORM
function initWaveform() {
  const c = document.getElementById('waveCanvas'); if (!c) return;
  const ctx = c.getContext('2d');
  let W = c.offsetWidth || 800, H = 80;
  c.width = W * devicePixelRatio; c.height = H * devicePixelRatio; ctx.scale(devicePixelRatio, devicePixelRatio);
  let t = 0;
  function draw() {
    ctx.clearRect(0, 0, W, H);
    [{ color: 'rgba(45,159,61,.45)', amp: 12, freq: .04, speed: .05, phase: 0 },
    { color: 'rgba(45,159,61,.22)', amp: 7, freq: .065, speed: .07, phase: 2 },
    { color: 'rgba(45,159,61,.1)', amp: 5, freq: .09, speed: .04, phase: 4 }
    ].forEach(w => {
      ctx.beginPath();
      for (let x = 0; x < W; x++) { const y = H / 2 + Math.sin(x * w.freq + t * w.speed + w.phase) * w.amp + Math.sin(x * .02 + t * .03) * 4; x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y) }
      ctx.strokeStyle = w.color; ctx.lineWidth = 1.5; ctx.stroke();
    });
    t++; requestAnimationFrame(draw);
  }
  draw();
}

// GRAPH
let graphNodes = [], graphEdges = [], graphMode = 'neural', graphT = 0, graphDragging = null, graphCanvas, graphCtx;
const GNODES = [
  { id: 'avi', label: 'Avi', icon: '⚡', x: .5, y: .5, r: 30, color: '#2d9f3d' },
  { id: 'ml', label: 'ML Pipeline', icon: '🤖', x: .2, y: .25, r: 22, color: '#2d9f3d' },
  { id: 'worker', label: 'CF Worker', icon: '☁️', x: .75, y: .22, r: 22, color: '#2d9f3d' },
  { id: 'tg', label: 'Telegram', icon: '📱', x: .15, y: .65, r: 18, color: '#787774' },
  { id: 'gh', label: 'GitHub', icon: '💻', x: .38, y: .78, r: 18, color: '#787774' },
  { id: 'kv', label: 'KV Store', icon: '🗄️', x: .65, y: .78, r: 18, color: '#787774' },
  { id: 'claude', label: 'Claude', icon: '🧠', x: .83, y: .52, r: 18, color: '#2383e2' },
  { id: 'data', label: 'Dashboard', icon: '📊', x: .28, y: .44, r: 16, color: '#787774' },
  { id: 'jarvis', label: 'JARVIS', icon: '🦾', x: .6, y: .38, r: 22, color: '#2d9f3d' },
];
const GEDGES = [['avi', 'jarvis'], ['avi', 'ml'], ['avi', 'worker'], ['worker', 'claude'], ['worker', 'kv'], ['ml', 'gh'], ['ml', 'data'], ['tg', 'worker'], ['jarvis', 'worker'], ['gh', 'kv']];
function initGraphCanvas() {
  graphCanvas = document.getElementById('graphCanvas'); if (!graphCanvas) return;
  graphCtx = graphCanvas.getContext('2d');
  const rect = () => graphCanvas.getBoundingClientRect();
  graphNodes = GNODES.map(n => ({ ...n, px: n.x * rect().width, py: n.y * rect().height, vx: 0, vy: 0 }));
  graphEdges = GEDGES.map(([a, b]) => ({ a: graphNodes.find(n => n.id === a), b: graphNodes.find(n => n.id === b) }));
  graphCanvas.addEventListener('mousedown', e => { const bb = rect(); const mx = e.clientX - bb.left, my = e.clientY - bb.top; graphDragging = graphNodes.find(n => Math.hypot(n.px - mx, n.py - my) < n.r + 6) || null });
  graphCanvas.addEventListener('mousemove', e => { if (!graphDragging) return; const bb = rect(); graphDragging.px = e.clientX - bb.left; graphDragging.py = e.clientY - bb.top });
  graphCanvas.addEventListener('mouseup', () => graphDragging = null);
  drawGraph();
}
function drawGraph() {
  if (!graphCanvas) return;
  const W = graphCanvas.offsetWidth, H = graphCanvas.offsetHeight;
  if (graphCanvas.width !== W * devicePixelRatio) { graphCanvas.width = W * devicePixelRatio; graphCanvas.height = H * devicePixelRatio; graphCtx.scale(devicePixelRatio, devicePixelRatio) }
  graphCtx.clearRect(0, 0, W, H); graphT += .005;
  if (!graphDragging) {
    graphNodes.forEach(n => {
      if (n.id !== 'avi') { n.px += Math.sin(graphT + n.r) * .25; n.py += Math.cos(graphT + n.r * .7) * .25; }
      else { n.px = W / 2 + Math.sin(graphT * .3) * 6; n.py = H / 2 + Math.cos(graphT * .22) * 6; }
    });
  }
  // Mode-dependent rendering
  const edgeAlpha = graphMode === 'cluster' ? '.2' : '.1';
  const nodeGlow = graphMode === 'flow';
  const clusterPulse = graphMode === 'cluster';

  graphEdges.forEach(e => {
    if (!e.a || !e.b) return;
    graphCtx.beginPath(); graphCtx.moveTo(e.a.px, e.a.py); graphCtx.lineTo(e.b.px, e.b.py);
    graphCtx.strokeStyle = `rgba(55,53,47,${edgeAlpha})`; graphCtx.lineWidth = graphMode === 'flow' ? 2 : 1.5; graphCtx.stroke();
    const t2 = ((graphT * 50) % 100) / 100; const mx = e.a.px + (e.b.px - e.a.px) * t2, my2 = e.a.py + (e.b.py - e.a.py) * t2;
    graphCtx.beginPath(); graphCtx.arc(mx, my2, graphMode === 'flow' ? 4 : 2.5, 0, Math.PI * 2);
    graphCtx.fillStyle = graphMode === 'flow' ? 'rgba(45,159,61,.8)' : 'rgba(45,159,61,.55)'; graphCtx.fill();
  });
  graphNodes.forEach(n => {
    const pulseR = clusterPulse ? n.r + Math.sin(graphT * 3 + n.r) * 3 : n.r;
    const grd = graphCtx.createRadialGradient(n.px, n.py, 0, n.px, n.py, pulseR);
    if (n.id === 'avi' || n.color === '#2d9f3d') { grd.addColorStop(0, 'rgba(45,159,61,.14)'); grd.addColorStop(1, 'rgba(45,159,61,.02)'); }
    else if (n.color === '#2383e2') { grd.addColorStop(0, 'rgba(35,131,226,.14)'); grd.addColorStop(1, 'rgba(35,131,226,.02)'); }
    else { grd.addColorStop(0, 'rgba(55,53,47,.07)'); grd.addColorStop(1, 'rgba(55,53,47,.01)'); }
    graphCtx.beginPath(); graphCtx.arc(n.px, n.py, pulseR, 0, Math.PI * 2);
    graphCtx.fillStyle = grd; graphCtx.fill();
    if (nodeGlow) {
      graphCtx.shadowColor = n.id === 'avi' ? 'rgba(45,159,61,.6)' : 'rgba(55,53,47,.2)';
      graphCtx.shadowBlur = 12;
    }
    graphCtx.strokeStyle = n.id === 'avi' ? 'rgba(45,159,61,.5)' : n.color === '#2383e2' ? 'rgba(35,131,226,.3)' : 'rgba(55,53,47,.15)';
    graphCtx.lineWidth = n.id === 'avi' ? 2 : 1; graphCtx.stroke();
    graphCtx.shadowBlur = 0;
    graphCtx.font = `${pulseR * .7}px serif`; graphCtx.textAlign = 'center'; graphCtx.textBaseline = 'middle';
    graphCtx.fillText(n.icon, n.px, n.py - 1);
    graphCtx.font = `500 10px Plus Jakarta Sans`; graphCtx.fillStyle = 'rgba(55,53,47,.55)';
    graphCtx.fillText(n.label, n.px, n.py + pulseR + 11);
  });
  requestAnimationFrame(drawGraph);
}
function setGraphMode(m, btn) {
  graphMode = m; document.querySelectorAll('.gcb').forEach(b => b.classList.remove('on')); btn.classList.add('on');
  showAchievement('Brain Mode', m.toUpperCase() + ' · +25 XP');
}
function resetGraph() {
  if (!graphCanvas) return; const W = graphCanvas.offsetWidth, H = graphCanvas.offsetHeight;
  graphNodes.forEach(n => { n.px = n.x * W; n.py = n.y * H });
}

// ARC REACTOR
let arcCtx2, arcSpeaking = false, arcAudioLevel = 0, arcT = 0;
function initArcReactor() {
  const c = document.getElementById('arc-canvas'); if (!c) return;
  const s = Math.min(c.parentElement.offsetWidth, c.parentElement.offsetHeight);
  c.width = s * devicePixelRatio; c.height = s * devicePixelRatio;
  arcCtx2 = c.getContext('2d'); arcCtx2.scale(devicePixelRatio, devicePixelRatio);
  if (!arcCtx2._running) { arcCtx2._running = true; drawArc(); }
}
function drawArc() {
  if (!arcCtx2) return;
  const c = document.getElementById('arc-canvas'); if (!c) return;
  const s = Math.min(c.offsetWidth, c.offsetHeight); const cx = s / 2, cy = s / 2; arcT += .008;
  arcCtx2.clearRect(0, 0, s, s);
  for (let i = 0; i < 6; i++) {
    arcCtx2.beginPath(); arcCtx2.arc(cx, cy, s * (.15 + i * .065), arcT * (i % 2 ? 1 : -1), arcT * (i % 2 ? 1 : -1) + Math.PI * (1.2 + Math.sin(arcT + i) * .3));
    arcCtx2.strokeStyle = `rgba(45,159,61,${(.05 - i * .007) * (1 + arcAudioLevel * .5)})`; arcCtx2.lineWidth = 1; arcCtx2.stroke();
  }
  if (arcSpeaking) { for (let w = 0; w < 2; w++) { const wR = s * (.50 + w * .05) + Math.sin(arcT * 8 + w * 2) * arcAudioLevel * s * .08; arcCtx2.beginPath(); arcCtx2.arc(cx, cy, wR, 0, Math.PI * 2); arcCtx2.strokeStyle = `rgba(45,159,61,${(.07 - w * .03) * arcAudioLevel})`; arcCtx2.lineWidth = 1.5; arcCtx2.stroke(); } }
  requestAnimationFrame(drawArc);
}
const audioBarsEl = document.getElementById('audio-bars');
if (audioBarsEl) {
  for (let i = 0; i < 40; i++) { const b = document.createElement('div'); b.className = 'abar'; b.style.minHeight = '4px'; audioBarsEl.appendChild(b); }
}
const abars = audioBarsEl ? audioBarsEl.querySelectorAll('.abar') : [];
function animAudioBars(speaking) {
  if (!audioBarsEl) return;
  if (!speaking) { abars.forEach(b => { b.style.height = '4px'; audioBarsEl.style.opacity = '0'; }); return; }
  audioBarsEl.style.opacity = '1';
  abars.forEach((b, i) => { b.style.height = (Math.abs(Math.sin(Date.now() * .003 + i * .4 + Math.random() * .2)) * 40 + 4) + 'px'; });
}
let audioAnim = null;
function startSpeaking() { arcSpeaking = true; function pulse() { arcAudioLevel = Math.abs(Math.sin(Date.now() * .004)) * .8 + .2; animAudioBars(true); audioAnim = requestAnimationFrame(pulse) } pulse() }
function stopSpeaking() { arcSpeaking = false; arcAudioLevel = 0; animAudioBars(false); if (audioAnim) cancelAnimationFrame(audioAnim) }

