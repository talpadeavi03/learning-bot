# AETHER Dashboard — Improvement Plan
> From good to **jaw-dropping**. Every panel should feel alive.

---

## Current State
The dashboard is a JARVIS/NVIDIA-themed dark UI with static hardcoded panels. After the data reset, all values show defaults. The goal is to make every panel **live**, **data-driven**, and **visually spectacular**.

---

## 🔥 Priority 1 — Make Everything Live (Data-Driven)

Right now many panels show hardcoded values. These should all pull from the Worker API.

### Changes Needed

| Panel | Current | Should Be |
|---|---|---|
| Energy Core (7.4) | Hardcoded | `GET /dashboard` → `avg_energy` |
| Focus / Mood / Sleep bars | Hardcoded % | Live from today's events |
| Recent Missions | Hardcoded list | Last 5 events from `/events` |
| Character Stats (6.2h, 12 tasks) | Hardcoded | Computed from today's events |
| Active Quests | Hardcoded goals | From `/dashboard` goals |
| JARVIS Insights | Hardcoded text | From `site/data/insights.json` |
| Neural Memory | Hardcoded entries | From recent events timeline |
| Mission Queue | Hardcoded tasks | Dynamic from KV goals + ML suggestions |
| Weekly Chart | Hardcoded data | From `/dashboard` → `week_energy[]` |
| Pipeline Status | Hardcoded | Live health check from `/health` |
| Power Level | Hardcoded 0 | Calculated: `energy × 100` |
| XP Bar | Static 73% | From event count / milestones |

### Implementation
Add a `loadDashboard()` function that fetches from `/dashboard` and `/events` on page load, then populates every panel with real data. Add a 60-second auto-refresh.

---

## 🎨 Priority 2 — Visual Upgrades

### A. Animated Energy Orb (replace static number)
Replace the boring "7.4" energy number with a **pulsing energy orb** that:
- Glows brighter when energy is high (green → white pulse)
- Dims and flickers when energy is low (amber → red)
- Particle effects orbit the orb based on flow state
- Smooth CSS animation, no canvas needed

### B. Real-Time Neural Waveform
The `waveCanvas` should show a **live EEG-style waveform** that:
- Draws continuously using requestAnimationFrame
- Amplitude reflects current energy level
- Color shifts based on flow state (green=flow, yellow=nominal, red=anxiety)
- Wave frequency increases with focus level

### C. Progress Rings Instead of Bars
Replace flat progress bars with **circular progress rings** for:
- Focus, Mood, Sleep, Productivity
- Animated fill on load
- Glow effect at the current value
- Number in the center

### D. Streak Fire Animation
When streak > 3 days:
- Show animated fire emoji / CSS fire effect next to streak count
- Streak number gets a glow pulse
- Each milestone (7, 14, 30 days) triggers a special achievement animation

### E. Flow State Indicator
A prominent flow state badge that:
- Shows current state: FLOW / PRE_FLOW / NOMINAL / ANXIETY / RECOVERY
- Color-coded with subtle pulse animation
- Changes the entire dashboard accent color based on state:
  - FLOW → Vibrant green
  - PRE_FLOW → Cyan
  - NOMINAL → Default NVIDIA green
  - ANXIETY → Amber/orange
  - RECOVERY → Soft blue

---

## 📊 Priority 3 — New Panels & Features

### A. Health Dashboard Section
New tab or expandable section showing:
- **Sleep tracker** — last 7 nights as a bar chart, average, quality trend
- **Exercise log** — weekly activity summary, streak
- **Water intake** — daily glasses with visual fill
- **Weight trend** — line chart over time
- Pull from events with `health_type` field

### B. Finance Tracker Section
- **Today's spending** — pie chart by category
- **Week/Month total** — vs last week comparison
- **Income vs Expense** — simple bar comparison
- Pull from events with `finance_type` field

### C. Activity Heatmap (GitHub-style)
- Calendar grid showing activity density
- Each day colored by event count (light → dark green)
- Hover shows day details
- Shows last 3 months
- Like GitHub contribution graph but for your life

### D. Peak Hours Heat Strip
- 24-hour horizontal strip
- Each hour colored by average energy level
- Highlights your peak focus windows
- Shows "Best time to code: 10AM–2PM" type insights

### E. Live Event Feed (Timeline)
Replace "Recent Missions" with a **real-time scrolling feed**:
- Events appear with smooth slide-in animation
- Each event shows: emoji icon, text, time ago, energy badge
- Auto-updates when new events arrive
- Color-coded by type (study=blue, code=green, health=orange, mood=purple)

### F. Goal Progress Tracker
Visual goal progress with:
- Circular progress for each active goal
- Daily goal at top with checkmark animation on completion
- Weekly goals as a horizontal progress bar
- Achievement badges popup when goals are hit

### G. AI Recommendations Panel
Fresh panel that shows ML-driven suggestions:
- "Your energy peaks at 10AM — schedule deep work now"
- "You haven't logged sleep in 3 days — your predictions are less accurate"
- "Stress trending up this week — consider a break"
- Updates after each ML pipeline run

---

## 📱 Priority 4 — Mobile Experience

### A. Bottom Navigation Bar (Mobile)
On mobile, replace the tab bar with a fixed bottom nav:
- 5 icons: Home, Data, Brain, Chat, Profile
- Smooth icon animations on tap
- Badge indicators for new insights

### B. Pull-to-Refresh
Add pull-to-refresh gesture on mobile to reload dashboard data.

### C. Swipe Between Views
Allow horizontal swipe to navigate between Home ↔ Data ↔ Brain ↔ System views.

### D. Quick Action Floating Button
Floating action button (FAB) on mobile:
- Tap → expand to show: Check-in, Mood, Goal, Chat
- Slide-up animation

---

## ⚡ Priority 5 — Interactive Features

### A. One-Tap Check-in Widget
Prominent check-in panel at the top:
- 5 energy level buttons (like mood selector but for energy)
- Quick mood selector
- One-tap submit → logs state via `POST /log-state`
- Confetti animation on check-in

### B. Keyboard Shortcuts
- `J` → Open JARVIS chat
- `1-5` → Quick mood log
- `G` → Set goal
- `D` → Switch to Data view
- `R` → Refresh dashboard

### C. Sound Effects (Optional Toggle)
- Subtle sci-fi beep on panel hover
- Achievement sound on milestones
- JARVIS voice confirmation on check-in
- Toggle in settings

### D. Dark/Light Mode Toggle
While dark is the brand, offer a subtle alternate theme:
- Light mode for outdoor use
- Toggle in header
- Saved to localStorage

---

## 🧠 Priority 6 — Smart Features

### A. Predictive Flow Timer
When model detects PRE_FLOW:
- Show a countdown: "Flow state likely in ~15 minutes"
- Suggest: "Stay focused — don't switch tasks"
- When FLOW is detected: "You're in flow! Timer: 0:34:12"

### B. Daily Score (Gamification Boost)
Calculate a daily score 0-100 based on:
- Events logged (max 30 pts)
- Goals completed (max 25 pts)
- Study/code time (max 25 pts)
- Health commands used (max 20 pts)
- Show as a big animated number with trend arrow

### C. Comparative Analytics
- "vs Yesterday" badges on every metric
- "This week vs last week" comparison cards
- Trend arrows (↑↓→) on every number
- Mini sparkline charts showing 7-day trends inline

### D. Smart Notifications
Use the Service Worker push notifications:
- "You haven't logged anything today — quick check-in?"
- "3-day streak! Keep it going."
- "Your model just trained — new predictions available"
- "Flow window approaching based on your pattern"

---

## Implementation Order (Suggested)

### Sprint 1 (This Week) — Make it Live
1. Add `loadDashboard()` function — fetch from `/dashboard` API
2. Populate all panels with real data
3. Add auto-refresh (60 seconds)
4. Show "No data yet" states gracefully

### Sprint 2 (Next Week) — Visual Polish
5. Animated energy orb
6. Progress rings for metrics
7. Live neural waveform
8. Flow state color theming
9. Streak fire animation

### Sprint 3 (Week 3) — New Panels
10. Live event feed / timeline
11. Activity heatmap
12. Health dashboard section
13. Peak hours heat strip

### Sprint 4 (Week 4) — Mobile + Interactive
14. Mobile bottom nav
15. One-tap check-in widget
16. Pull-to-refresh
17. Keyboard shortcuts

### Sprint 5 (Month 2) — Smart Features
18. Predictive flow timer
19. Daily score gamification
20. Comparative analytics (vs yesterday)
21. Smart push notifications
22. Finance tracker
23. AI recommendations panel

---

> **The single biggest improvement**: Make `loadDashboard()` pull real data from the API. Everything else is polish — but this one change makes the dashboard actually useful instead of a pretty demo.
