// VIEW SWITCHING
const bcNames = { home: 'Home', data: 'Data', graph: 'Brain', system: 'System', docs: 'Docs' };
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
  if (name === 'data') { setTimeout(() => { animateBars(); initCharts(); initWaveform() }, 50) }
  if (name === 'graph') { setTimeout(initGraphCanvas, 50) }
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

// PASSWORD
let AETHER_PASSKEY = null;
function openGate() { document.getElementById('pw-gate').classList.add('show') }
function closeGate() { document.getElementById('pw-gate').classList.remove('show') }
function checkPassword() {
  const v = document.getElementById('pw-input').value; const err = document.getElementById('pw-error');
  if (v === 'aether2024') { 
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
    const res = await fetch("/tabs");
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
    const res = await fetch("/events");
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

setInterval(loadTabs, 5000);
setInterval(loadNeuralMemory, 5000);
setTimeout(loadTabs, 1000);
setTimeout(loadNeuralMemory, 1000);

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
