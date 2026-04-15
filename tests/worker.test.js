/**
 * AETHER OS — Test Suite
 * Tests for core worker functions (analyzeState, fallbackNLP, checkAdminAuth)
 * Run: node --test tests/worker.test.js
 */

import { describe, it } from 'node:test';
import { strict as a } from 'node:assert';

// ═══════════════════════════════════════════════════════════════
// EXTRACT PURE FUNCTIONS (copied from worker.js for testing)
// In a real refactor these would be imported as modules
// ═══════════════════════════════════════════════════════════════

function analyzeState(events, dashboard) {
  if (!events.length) return { state: "unknown", energy: 0, stress: 0, focus: 0, motivation: 0, advice: "No data yet. Send messages to AETHER to start tracking." };
  const recentSlice = events.slice(-5);
  const energy = recentSlice.reduce((s, e) => s + (e.energy_signal ?? 0.5), 0) / recentSlice.length;
  const stress = recentSlice.reduce((s, e) => s + (e.stress_signal ?? 0.2), 0) / recentSlice.length;
  const focus = recentSlice.reduce((s, e) => s + (e.focus_signal ?? 0.5), 0) / recentSlice.length;
  const motivation = recentSlice.reduce((s, e) => s + (e.motivation_signal ?? 0.5), 0) / recentSlice.length;
  let state = "neutral", advice = "";
  if (energy < 0.3 && stress > 0.6) { state = "burnout"; advice = "burn"; }
  else if (stress > 0.65) { state = "high_stress"; advice = "stress"; }
  else if (energy < 0.35 && stress < 0.4) { state = "recovery"; advice = "recovery"; }
  else if (focus < 0.4 && energy > 0.5) { state = "distracted"; advice = "distracted"; }
  else if (focus < 0.4) { state = "low_focus"; advice = "focus"; }
  else if (energy > 0.7 && focus > 0.6 && stress < 0.3) { state = "flow_ready"; advice = "flow"; }
  else if (energy > 0.6 && focus > 0.5) { state = "productive"; advice = "productive"; }
  else if (energy > 0.5 && motivation > 0.6) { state = "motivated"; advice = "motivated"; }
  else if (energy > 0.4 && energy <= 0.6 && stress <= 0.4) { state = "steady"; advice = "steady"; }
  else { state = "moderate"; advice = "mixed"; }
  return { state, energy, stress, focus, motivation, advice };
}

function fallbackNLP(text) {
  const lower = text.toLowerCase();
  const highEnergyWords = ['excited', 'great', 'amazing', 'productive', 'focused', 'motivated',
    'energized', 'pumped', 'awesome', 'fantastic', 'killing it', 'crushing', 'on fire',
    'built', 'deployed', 'shipped', 'completed', 'finished', 'achieved', 'nailed',
    'workout', 'gym', 'exercise', 'run', 'morning routine', 'woke up early'];
  const lowEnergyWords = ['tired', 'exhausted', 'drained', 'sleepy', 'lazy', 'slow',
    'fatigue', 'burnt', 'burned out', 'no energy', "can't focus", 'recovery',
    'resting', 'nap', 'crashed', 'wasted', 'procrastinat', 'bored'];
  const highStressWords = ['stressed', 'overwhelmed', 'anxious', 'worried', 'deadline',
    'stuck', 'confused', 'panic', 'frustrated', 'angry', 'annoyed', 'pressure',
    'too much', 'behind', 'failing', 'mess', 'broke', 'error', 'bug', 'crash'];
  const highFocusWords = ['coding', 'building', 'studying', 'learning', 'deep work',
    'focused session', 'reading', 'writing', 'debugging', 'practicing', 'research',
    'terraform', 'kubernetes', 'docker', 'pipeline', 'deploying', 'configuring'];
  const lowFocusWords = ['distracted', 'scrolling', 'youtube', 'netflix', 'instagram',
    'social media', 'phone', 'procrastinat'];
  const studyWords = ['learned', 'studied', 'reading', 'course', 'practice', 'revision',
    'chapter', 'tutorial', 'lesson', 'documentation', 'notes', 'cert', 'exam',
    'learning', 'coding', 'building', 'lab', 'hands-on', 'project'];
  const countMatches = (words) => words.filter(w => lower.includes(w)).length;
  const highE = countMatches(highEnergyWords);
  const lowE = countMatches(lowEnergyWords);
  const highS = countMatches(highStressWords);
  const highF = countMatches(highFocusWords);
  const lowF = countMatches(lowFocusWords);
  const isStudy = studyWords.some(w => lower.includes(w));
  let energy = 0.5;
  if (highE > 0 || lowE > 0) energy = Math.max(0.05, Math.min(0.95, 0.5 + highE * 0.15 - lowE * 0.2));
  let stress = 0.2;
  if (highS > 0) stress = Math.max(0.05, Math.min(0.95, 0.2 + highS * 0.2));
  let focus = 0.5;
  if (highF > 0 || lowF > 0) focus = Math.max(0.1, Math.min(0.95, 0.5 + highF * 0.15 - lowF * 0.2));
  else if (isStudy) focus = 0.75;
  return { energy_signal: Math.round(energy * 100) / 100, stress_signal: Math.round(stress * 100) / 100, focus_signal: Math.round(focus * 100) / 100, is_study_session: isStudy };
}

function checkAdminAuth(request, env) {
  const adminKey = env.ADMIN_KEY;
  if (!adminKey) return true;
  const provided = request.headers.get('X-Admin-Key') || '';
  return provided === adminKey;
}

// ═══════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════

describe('analyzeState', () => {
  it('returns unknown for empty events', () => {
    const result = analyzeState([], {});
    a.equal(result.state, 'unknown');
    a.equal(result.energy, 0);
  });

  it('detects burnout (low energy + high stress)', () => {
    const events = [{ energy_signal: 0.2, stress_signal: 0.8, focus_signal: 0.3, motivation_signal: 0.2 }];
    const result = analyzeState(events, {});
    a.equal(result.state, 'burnout');
  });

  it('detects flow_ready (high energy + high focus + low stress)', () => {
    const events = [{ energy_signal: 0.85, stress_signal: 0.1, focus_signal: 0.8, motivation_signal: 0.7 }];
    const result = analyzeState(events, {});
    a.equal(result.state, 'flow_ready');
  });

  it('detects recovery (low energy + low stress)', () => {
    const events = [{ energy_signal: 0.25, stress_signal: 0.2, focus_signal: 0.5, motivation_signal: 0.4 }];
    const result = analyzeState(events, {});
    a.equal(result.state, 'recovery');
  });

  it('detects high_stress', () => {
    const events = [{ energy_signal: 0.5, stress_signal: 0.8, focus_signal: 0.5, motivation_signal: 0.5 }];
    const result = analyzeState(events, {});
    a.equal(result.state, 'high_stress');
  });

  it('detects distracted (energy ok but focus low)', () => {
    const events = [{ energy_signal: 0.6, stress_signal: 0.3, focus_signal: 0.3, motivation_signal: 0.5 }];
    const result = analyzeState(events, {});
    a.equal(result.state, 'distracted');
  });

  it('detects productive', () => {
    const events = [{ energy_signal: 0.65, stress_signal: 0.3, focus_signal: 0.55, motivation_signal: 0.5 }];
    const result = analyzeState(events, {});
    a.equal(result.state, 'productive');
  });

  it('averages last 5 events', () => {
    const events = [
      { energy_signal: 0.9, stress_signal: 0.1 },
      { energy_signal: 0.1, stress_signal: 0.9 },
      { energy_signal: 0.5, stress_signal: 0.5 },
      { energy_signal: 0.5, stress_signal: 0.5 },
      { energy_signal: 0.5, stress_signal: 0.5 },
    ];
    const result = analyzeState(events, {});
    a.ok(result.energy > 0.4 && result.energy < 0.6, `energy should be ~0.5, got ${result.energy}`);
  });
});

describe('fallbackNLP', () => {
  it('detects high energy words', () => {
    const result = fallbackNLP('I am so excited and pumped today!');
    a.ok(result.energy_signal > 0.6, `energy should be > 0.6, got ${result.energy_signal}`);
  });

  it('detects low energy / tiredness', () => {
    const result = fallbackNLP('feeling exhausted and tired, no energy left');
    a.ok(result.energy_signal < 0.3, `energy should be < 0.3, got ${result.energy_signal}`);
  });

  it('detects stress', () => {
    const result = fallbackNLP('so stressed about the deadline, feeling overwhelmed and anxious');
    a.ok(result.stress_signal > 0.5, `stress should be > 0.5, got ${result.stress_signal}`);
  });

  it('detects focus from coding', () => {
    const result = fallbackNLP('been coding and debugging for 2 hours');
    a.ok(result.focus_signal > 0.6, `focus should be > 0.6, got ${result.focus_signal}`);
  });

  it('detects study session', () => {
    const result = fallbackNLP('studied chapter 4, reading documentation');
    a.equal(result.is_study_session, true);
    a.ok(result.focus_signal > 0.6, `focus should be > 0.6 for study, got ${result.focus_signal}`);
  });

  it('detects distractions (low focus)', () => {
    const result = fallbackNLP('been scrolling instagram and youtube all day, totally distracted');
    a.ok(result.focus_signal < 0.3, `focus should be < 0.3, got ${result.focus_signal}`);
  });

  it('neutral message returns moderate defaults', () => {
    const result = fallbackNLP('hello there');
    a.equal(result.energy_signal, 0.5);
    a.equal(result.stress_signal, 0.2);
    a.equal(result.focus_signal, 0.5);
  });

  it('detects DevOps keywords', () => {
    const result = fallbackNLP('deploying terraform pipeline and configuring kubernetes');
    a.ok(result.focus_signal > 0.7, `focus should be > 0.7 for DevOps keywords, got ${result.focus_signal}`);
  });
});

describe('checkAdminAuth', () => {
  const mockRequest = (key) => ({ headers: { get: (h) => h === 'X-Admin-Key' ? key : null } });

  it('allows when no ADMIN_KEY is set (dev mode)', () => {
    a.equal(checkAdminAuth(mockRequest(''), {}), true);
  });

  it('allows correct key', () => {
    a.equal(checkAdminAuth(mockRequest('secret123'), { ADMIN_KEY: 'secret123' }), true);
  });

  it('blocks wrong key', () => {
    a.equal(checkAdminAuth(mockRequest('wrong'), { ADMIN_KEY: 'secret123' }), false);
  });

  it('blocks missing key', () => {
    a.equal(checkAdminAuth(mockRequest(''), { ADMIN_KEY: 'secret123' }), false);
  });
});
