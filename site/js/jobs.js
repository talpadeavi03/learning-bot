// ═══════════════════════════════════════════
// JOBS INTELLIGENCE TAB — Logic
// ═══════════════════════════════════════════

const JOBS_KEY = 'aether_jobs';
let allJobs = [];
let jobFilter = 'all';

// ─── PERSISTENCE ─────────────────────────
function loadJobs() {
  try {
    allJobs = JSON.parse(localStorage.getItem(JOBS_KEY) || '[]');
  } catch { allJobs = []; }
}

function saveJobs() {
  localStorage.setItem(JOBS_KEY, JSON.stringify(allJobs));
}

// ─── ANALYZE EMAIL ───────────────────────
async function analyzeJobEmail() {
  const textarea = document.getElementById('job-email-input');
  const body = textarea.value.trim();
  if (!body) return;

  const btn = document.getElementById('job-analyze-btn');
  const loadingEl = document.getElementById('job-loading');
  btn.disabled = true;
  loadingEl.style.display = 'flex';

  try {
    const res = await fetch(WORKER_URL + '/jobs/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_body: body })
    });

    if (!res.ok) throw new Error('API error');

    const data = await res.json();

    const job = {
      id: Date.now(),
      date: new Date().toISOString(),
      company: data.company || 'Unknown',
      role: data.role || 'Unknown',
      location: data.location || 'Unknown',
      salary: data.salary || 'Not mentioned',
      job_type: data.job_type || 'Unknown',
      fit_score: data.fit_score || 5,
      fit_reason: data.fit_reason || '',
      sender: data.sender || '',
      reply_email: data.reply_email || '',
      status: data.fit_score >= 6 ? 'pending' : 'low_fit',
      email_body: body
    };

    allJobs.unshift(job);
    saveJobs();
    textarea.value = '';
    renderJobs();
    showAchievement('Job Analyzed ✅', `${job.company} · Fit: ${job.fit_score}/10`);

  } catch (err) {
    console.error('Job analysis failed:', err);
    // Fallback: create a placeholder entry
    const job = {
      id: Date.now(),
      date: new Date().toISOString(),
      company: extractField(body, 'company') || 'Unknown',
      role: extractField(body, 'role') || 'Unknown',
      location: 'Unknown',
      salary: 'Not mentioned',
      job_type: 'Unknown',
      fit_score: 5,
      fit_reason: 'Could not analyze — worker may be offline',
      sender: '',
      reply_email: '',
      status: 'pending',
      email_body: body
    };
    allJobs.unshift(job);
    saveJobs();
    textarea.value = '';
    renderJobs();
    showAchievement('Job Saved (Offline)', 'Worker offline — saved locally');
  } finally {
    btn.disabled = false;
    loadingEl.style.display = 'none';
  }
}

// Basic keyword extraction fallback
function extractField(text, field) {
  const lower = text.toLowerCase();
  if (field === 'company') {
    const patterns = [/at\s+([A-Z][a-zA-Z\s&]+)/, /company:\s*(.+)/i, /from\s+([A-Z][a-zA-Z\s&]+)/];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim().substring(0, 40);
    }
  }
  if (field === 'role') {
    const patterns = [/role:\s*(.+)/i, /position:\s*(.+)/i, /hiring\s+(?:for\s+)?(?:a\s+)?(.+?)(?:\s+at|\s+in|\.|$)/i];
    for (const p of patterns) {
      const m = text.match(p);
      if (m) return m[1].trim().substring(0, 60);
    }
  }
  return null;
}

// ─── RENDER ───────────────────────────────
function renderJobs() {
  loadJobs();
  const list = document.getElementById('jobs-list');
  const emptyEl = document.getElementById('jobs-empty');
  if (!list) return;

  // Filter
  let filtered = allJobs;
  if (jobFilter === 'high')    filtered = allJobs.filter(j => j.fit_score >= 7);
  if (jobFilter === 'pending') filtered = allJobs.filter(j => j.status === 'pending');
  if (jobFilter === 'replied') filtered = allJobs.filter(j => j.status === 'replied');

  // Sort
  const sortVal = document.getElementById('jobs-sort')?.value || 'date';
  if (sortVal === 'score') filtered.sort((a, b) => b.fit_score - a.fit_score);
  else filtered.sort((a, b) => new Date(b.date) - new Date(a.date));

  // Stats
  updateJobStats();

  // Update filter counts
  updateFilterCounts();

  // Count display
  const countEl = document.getElementById('jobs-count');
  if (countEl) countEl.textContent = `${filtered.length} of ${allJobs.length} jobs`;

  if (filtered.length === 0) {
    list.innerHTML = '';
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  list.innerHTML = filtered.map(j => {
    const fitClass = j.fit_score >= 7 ? 'high' : j.fit_score >= 5 ? 'mid' : 'low';
    const statusTag = j.status === 'replied'
      ? '<span class="tag tg">Replied</span>'
      : j.status === 'low_fit'
      ? '<span class="tag tgr">Low Fit</span>'
      : '<span class="tag ty">Pending</span>';
    const dateStr = new Date(j.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });

    return `
      <div class="job-row" data-id="${j.id}">
        <div class="job-fit">
          <div class="job-fit-num ${fitClass}">${j.fit_score}</div>
          <div class="job-fit-label">FIT</div>
          <div class="job-fit-bar"><div class="job-fit-fill ${fitClass}" style="width:${j.fit_score * 10}%"></div></div>
        </div>
        <div class="job-info">
          <div class="job-role">${escapeHtml(j.role)}</div>
          <div class="job-company">
            ${escapeHtml(j.company)}
            <span style="color:var(--text3)">·</span>
            ${statusTag}
          </div>
        </div>
        <div class="job-meta">
          <div class="job-meta-item">📍 ${escapeHtml(j.location)}</div>
          <div class="job-meta-item">💰 ${escapeHtml(j.salary)}</div>
          <div class="job-meta-item">📅 ${dateStr}</div>
        </div>
        <div class="job-actions">
          ${j.reply_email ? `<button class="job-reply-btn" onclick="viewJobReply(${j.id})">View Reply</button>` : ''}
          <button class="job-delete-btn" onclick="deleteJob(${j.id})" title="Remove">✕</button>
        </div>
      </div>
    `;
  }).join('');
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.textContent = str || '';
  return d.innerHTML;
}

function updateJobStats() {
  const total = allJobs.length;
  const highFit = allJobs.filter(j => j.fit_score >= 7).length;
  const pending = allJobs.filter(j => j.status === 'pending').length;
  const replied = allJobs.filter(j => j.status === 'replied').length;
  const avgScore = total > 0 ? (allJobs.reduce((s, j) => s + j.fit_score, 0) / total).toFixed(1) : '—';

  const el = id => document.getElementById(id);
  if (el('js-total'))    el('js-total').textContent    = total;
  if (el('js-high'))     el('js-high').textContent     = highFit;
  if (el('js-pending'))  el('js-pending').textContent  = pending;
  if (el('js-avg'))      el('js-avg').textContent      = avgScore;
}

function updateFilterCounts() {
  const counts = {
    all: allJobs.length,
    high: allJobs.filter(j => j.fit_score >= 7).length,
    pending: allJobs.filter(j => j.status === 'pending').length,
    replied: allJobs.filter(j => j.status === 'replied').length
  };
  document.querySelectorAll('.jobs-filter').forEach(btn => {
    const type = btn.dataset.filter;
    const countEl = btn.querySelector('.jobs-filter-count');
    if (countEl && counts[type] !== undefined) {
      countEl.textContent = counts[type];
    }
  });
}

// ─── FILTER ──────────────────────────────
function filterJobs(type, btn) {
  jobFilter = type;
  document.querySelectorAll('.jobs-filter').forEach(b => b.classList.remove('on'));
  btn.classList.add('on');
  renderJobs();
}

function sortJobsChanged() {
  renderJobs();
}

// ─── DELETE ──────────────────────────────
function deleteJob(id) {
  allJobs = allJobs.filter(j => j.id !== id);
  saveJobs();
  renderJobs();
}

// ─── REPLY MODAL ─────────────────────────
function viewJobReply(id) {
  const job = allJobs.find(j => j.id === id);
  if (!job) return;

  document.getElementById('jm-title').textContent = `Reply — ${job.role}`;
  document.getElementById('jm-company').textContent = job.company;
  document.getElementById('jm-role').textContent = job.role;
  document.getElementById('jm-score').textContent = `${job.fit_score}/10`;
  document.getElementById('jm-reason').textContent = job.fit_reason;
  document.getElementById('jm-reply-text').textContent = job.reply_email;

  document.getElementById('jobs-modal').classList.add('show');
  document.getElementById('jobs-modal').dataset.jobId = id;
}

function closeJobModal() {
  document.getElementById('jobs-modal').classList.remove('show');
}

function copyJobReply() {
  const text = document.getElementById('jm-reply-text').textContent;
  navigator.clipboard.writeText(text).then(() => {
    showAchievement('Copied! 📋', 'Reply copied to clipboard');
  });
}

function markJobReplied() {
  const id = parseInt(document.getElementById('jobs-modal').dataset.jobId);
  const job = allJobs.find(j => j.id === id);
  if (job) {
    job.status = 'replied';
    saveJobs();
    renderJobs();
    closeJobModal();
    showAchievement('Marked Replied ✅', `${job.company} — done`);
  }
}

// ─── GMAIL SYNC ──────────────────────────
async function syncGmail() {
  try {
    const res = await fetch(WORKER_URL + '/jobs/gmail', { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    if (res.ok) {
      const data = await res.json();
      showAchievement('Gmail Synced ✅', (data.count || 0) + ' new messages processed');
      loadJobs();
    } else {
      showAchievement('Gmail Sync', 'Worker returned ' + res.status + ' — check server logs');
    }
  } catch (e) {
    showAchievement('Gmail Sync Failed', 'Worker offline or endpoint not configured');
  }
}

// ─── INIT ────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  loadJobs();
  renderJobs();
});
