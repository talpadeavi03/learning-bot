# AETHER ML — Daily Data Feeding Guide
> How to train your AI to actually understand you — one message at a time.

---

## Why This Matters

Your ML model (RandomForest + GBM) learns from **14 features** extracted from every message you send. Right now it has ~95 events and shows 98.9% CV accuracy — but that's **overfitting on limited data**. The model needs **200+ diverse events** across different energy levels, times, topics, and moods to make real, useful predictions.

Think of it like this:
- **< 50 events** → Model is guessing
- **50–100 events** → Model sees basic patterns
- **100–200 events** → Model starts being useful
- **200–500 events** → Model is genuinely productive
- **500+ events** → Model knows you better than you know yourself

---

## The 14 Features Your Model Learns From

Every message you send gets parsed into these features. **You need to vary ALL of them** for the model to learn properly.

| # | Feature | What Drives It | How to Vary |
|---|---|---|---|
| 1 | `energy_signal` | Your energy level in the message | Send messages when tired AND energized |
| 2 | `stress_signal` | Stress/anxiety indicators | Log calm days AND stressful days |
| 3 | `focus_signal` | Focus/concentration markers | Log when focused AND scattered |
| 4 | `motivation_signal` | Motivation indicators | Log when motivated AND unmotivated |
| 5 | `hour_sin` | Time of day (cyclical) | Send messages at different hours |
| 6 | `hour_cos` | Time of day (cyclical) | Morning, afternoon, evening, night |
| 7 | `day_of_week` | Which day it is | Log on weekdays AND weekends |
| 8 | `is_weekend` | Weekend flag | Important — model learns work/rest patterns |
| 9 | `word_count` | How much you write | Send short AND long messages |
| 10 | `complexity` | Message complexity | Simple updates AND detailed reflections |
| 11 | `question_ratio` | Questions in message | Ask questions sometimes |
| 12 | `is_study_session` | Study/learning markers | Log study sessions AND non-study activities |
| 13 | `is_goal_mention` | Goal references | Mention goals sometimes |
| 14 | `is_complaint` | Complaints/frustrations | Be honest about bad days too |

---

## Daily Data Feeding Protocol

### ☀️ Morning Check-in (8:00–9:30 AM)

Send **one message** to your Telegram bot describing how you feel waking up.

**High energy morning examples:**
```
Woke up at 6:30, slept 8 hours, feeling charged. Ready to crush the ML pipeline today.
```
```
Great morning. Energy is high, no stress. Planning to study neural networks chapter 5.
```

**Low energy morning examples:**
```
Barely slept 4 hours. Exhausted. Not sure what I'll get done today.
```
```
Woke up late, feeling groggy. Might just do light tasks today.
```

**Also log your sleep:**
```
/sleep 7.5
```

---

### 🔥 Work Session Logs (10:00 AM – 6:00 PM)

Log **2–3 messages** during your work/study sessions. The NLP parser extracts energy, focus, and topic automatically.

**Deep focus session:**
```
Deep into Kubernetes networking. Setting up ingress controllers. Fully focused, no distractions. Been at it for 2 hours.
```

**Coding session:**
```
Building the ML feature pipeline. Writing Python, testing edge cases. Flow state right now — don't want to stop.
```

**Unfocused/scattered session:**
```
Can't focus today. Jumping between tabs. Started 3 tasks, finished none. Brain feels foggy.
```

**Study session:**
```
Studying chapter 6 of the deep learning textbook. Taking notes on backpropagation. This is hard but making progress.
```

**Also use commands during work:**
```
/goal Finish ML pipeline v2 and deploy
/mood 4
/exercise 30 running
/water 1
/food Dal rice with salad
```

---

### 🌙 Evening Reflection (8:00–10:00 PM)

Send **one detailed message** reflecting on the day. This is the most valuable data point.

**Productive day:**
```
Great day. Finished the ML pipeline, deployed to staging, and studied for 2 hours. Energy stayed high all day. Feeling accomplished and motivated for tomorrow. Going to sleep early tonight.
```

**Average day:**
```
Decent day but not my best. Got some coding done in the morning but lost focus after lunch. Need to plan better tomorrow. At least I kept my streak going.
```

**Tough day:**
```
Rough day. High stress from job applications. Got 2 rejections. Barely coded anything. Feeling demotivated. Going to rest and try again tomorrow.
```

**Also log evening commands:**
```
/mood 3
/sleep 6.5
/spend 200 food
```

---

## Weekly Data Diversity Checklist

Use this checklist every week to make sure you're giving the model diverse signals:

### Energy Levels (aim for all 5 in a week)
- [ ] 🔴 Very low energy message (exhausted, sick, burned out)
- [ ] 🟠 Low energy message (tired, groggy, unmotivated)
- [ ] 🟡 Neutral energy message (average, routine)
- [ ] 🟢 High energy message (focused, productive, motivated)
- [ ] 🔵 Peak energy message (flow state, on fire, crushing it)

### Time Windows (aim for all 4 daily)
- [ ] 🌅 Morning (6:00–10:00 AM) — at least 1 message
- [ ] ☀️ Midday (10:00 AM–2:00 PM) — at least 1 message
- [ ] 🌤️ Afternoon (2:00–6:00 PM) — at least 1 message
- [ ] 🌙 Evening (6:00–11:00 PM) — at least 1 message

### Activity Types (aim for 4+ types per week)
- [ ] 💻 Coding / building session
- [ ] 📚 Study / learning session
- [ ] 🧠 Research / reading
- [ ] 💪 Exercise / health
- [ ] 🍽️ Food / nutrition log
- [ ] 💰 Expense / income log
- [ ] 💼 Job / career update
- [ ] 😴 Sleep log
- [ ] 🎯 Goal setting
- [ ] 😊 Mood check-in

### Emotional Range (be honest — the model needs this)
- [ ] 😤 Frustrated / angry message
- [ ] 😰 Stressed / anxious message
- [ ] 😐 Neutral / routine message
- [ ] 😊 Happy / satisfied message
- [ ] 🔥 Excited / fired up message
- [ ] 😴 Tired / exhausted message

### Message Types
- [ ] Short message (< 10 words)
- [ ] Medium message (10–30 words)
- [ ] Long message (30+ words)
- [ ] Question-heavy message ("Should I...? What if...?")
- [ ] Goal-focused message ("I want to..., My target is...")
- [ ] Complaint/vent message ("This is annoying, I'm frustrated with...")

---

## Quick Daily Templates

Copy-paste and customize these until sending messages becomes second nature:

### Template 1 — Morning State
```
Morning. Energy: [high/medium/low]. Slept [X] hours. 
Plan: [what you'll do today]. Feeling [emotion].
```

### Template 2 — Work Log
```
[What you're doing]. Been at it for [X] minutes.
Focus level: [sharp/ok/scattered]. Topic: [subject].
```

### Template 3 — Evening Wrap
```
Day rating: [1-10]. Got done: [tasks]. 
Didn't do: [missed tasks]. Energy now: [high/low].
Tomorrow: [plan].
```

### Template 4 — Quick Mood Dump
```
Feeling [emotion] right now. [One sentence why].
```

---

## Command Cheat Sheet for Daily Logging

Run these commands throughout the day for structured data:

```
# ── MORNING ──
/sleep 7                    # Log last night's sleep
/mood 4                     # Morning mood (1-5)
/goal Build feature X       # Set today's main goal
/water 0.5                  # First glass of water

# ── DURING WORK ──
/exercise 30 walking        # If you exercised
/water 0.5                  # Stay hydrated
/food Oats with banana      # Log meals
/mood 3                     # Midday mood check

# ── EVENING ──
/spend 150 dinner           # Log expenses
/mood 4                     # Evening mood
/food Rice dal sabzi        # Dinner log
/water 0.5                  # Evening water

# ── CAREER (when applicable) ──
/job Google                 # Log applications
/interview Amazon           # Log interviews
/income 5000 freelance      # Log income
```

---

## What GOOD Data Looks Like vs BAD Data

### ❌ BAD — Same message every day
```
Did some work today. Feeling ok.
Did some work today. Feeling ok.
Did some work today. Feeling ok.
```
**Problem**: Every event has identical features → model learns nothing.

### ❌ BAD — Only logging good days
```
Crushed it today! Built 3 features and studied for 4 hours!
Amazing day. Flow state all afternoon. Feeling incredible.
Best day ever. Got the job callback and finished the project.
```
**Problem**: Model only sees high-energy data → can't predict low-energy states.

### ✅ GOOD — Varied, honest, specific
```
Morning, barely slept. Trying to code but can't focus. Might take a break.
```
```
Deep in Kubernetes tutorial. 2 hours in, flow state. Don't want to stop.
```
```
Just had coffee, energy coming back. Going to try the ML pipeline fix.
```
```
Frustrated with the deployment bug. Spent 3 hours, still broken. Stressful.
```
```
Evening. Relaxing now. Day was average — got some things done but not my best. Tomorrow I'll focus on the API.
```

---

## The 30-Day Jumpstart Plan

Follow this to build a solid training dataset in one month:

### Week 1 — Build the Habit (Goal: 5 messages/day)
| Day | Morning | Work 1 | Work 2 | Evening | Commands |
|---|---|---|---|---|---|
| Mon | Energy check | Code log | Study log | Day reflection | /sleep /mood /goal |
| Tue | Energy check | Code log | — | Day reflection | /mood /food |
| Wed | Energy check | Study log | Research | Day reflection | /exercise /water |
| Thu | Energy check | Code log | — | Day reflection | /mood /spend |
| Fri | Energy check | Code log | Study log | Day reflection | /sleep /mood |
| Sat | Relaxed check | Free log | — | Weekend reflection | /mood |
| Sun | Relaxed check | — | — | Week reflection | /mood /food |

**Week 1 target: 28+ events**

### Week 2 — Vary the Signals (Goal: 5 messages/day + emotional range)
- Include at least **2 negative/frustrated messages**
- Log at **different times** (vary your schedule)
- Try long reflective messages (50+ words)
- Use **all health commands** at least once

**Week 2 target: 28+ events (56+ cumulative)**

### Week 3 — Deepen the Data (Goal: 6 messages/day)
- Add career commands (/job, /interview)
- Add finance commands (/spend, /income)
- Log weekend activities differently from weekdays
- Write at least one **question-heavy** message

**Week 3 target: 35+ events (91+ cumulative)**

### Week 4 — Quality Polish (Goal: 5+ messages/day)
- Review which feature categories you've neglected
- Fill in energy level gaps (log a very low AND very high energy day)
- Write detailed study session logs
- Log your actual sleep quality honestly

**Week 4 target: 28+ events (119+ cumulative)**

### After 30 Days
- **Total events**: 120–150+
- **ML model**: Should show realistic (not 100%) accuracy with genuine predictive power
- **Flow predictions**: Should become surprisingly accurate for YOUR patterns
- **Peak hours**: Model will know your best focus windows

---

## How to Know Your Model is Getting Better

After the nightly ML pipeline runs, check `models/training_stats.json`:

```json
{
  "n_events": 200,          // ← aim for 200+
  "rf_accuracy": 0.85,      // ← 80-90% = healthy (100% = overfitting)
  "cv_score": 0.78,         // ← cross-validation should be 75%+
  "flow_distribution": {
    "FLOW": 30,             // ← need 20+ of each class
    "PRE_FLOW": 45,
    "NOMINAL": 80,
    "ANXIETY": 25,
    "RECOVERY": 20
  }
}
```

### Signs the Model is Healthy
- ✅ CV score between 70–90% (not 100%)
- ✅ All 5 flow states have 15+ samples each
- ✅ Top features are spread across 3+ features (not just one)
- ✅ Predictions change based on time of day and recent activity

### Signs the Model Needs More Data
- ⚠️ CV score is 100% → overfitting, need more diverse data
- ⚠️ Some flow states have 0 samples → log when in those states
- ⚠️ One feature has 90%+ importance → data lacks variety
- ⚠️ Predictions are always the same → not enough signal variation

---

## Automating Data Collection

### Already Automated (Zero Effort)
| Source | What Gets Logged | Pipeline |
|---|---|---|
| GitHub Pushes | Every commit → event with energy estimate | `github_activity.yml` |
| Cron Briefings | 3x daily Telegram briefings | Worker cron triggers |

### Semi-Automated (One Tap)
| Action | How | Data Generated |
|---|---|---|
| Quick mood | `/mood 4` | energy, stress, sentiment |
| Sleep log | `/sleep 7` | sleep hours, quality, energy forecast |
| Water | `/water 0.5` | hydration tracking |
| Exercise | `/exercise 30 pushups` | activity, duration, energy |

### Manual (Most Valuable)
| Action | Why It's Valuable | Effort |
|---|---|---|
| Free-text messages | Richest feature extraction (NLP parses emotion, topic, complexity) | 30 sec |
| Detailed reflections | Teaches the model about your deep patterns | 2 min |
| Honest bad-day logs | Without this, model can't predict low states | 30 sec |

---

## Golden Rules

1. **Log at least 3 messages per day** — morning, work, evening
2. **Be honest** — fake positive data makes a useless model
3. **Vary your times** — don't always log at the same hour
4. **Include bad days** — the model NEEDS frustrated/tired/low data
5. **Use commands AND free text** — commands give structured data, free text gives NLP features
6. **Log on weekends too** — `is_weekend` is a feature, model needs weekend data
7. **Don't batch-send** — spacing messages throughout the day gives time features meaning
8. **Keep going** — the model gets exponentially better after 200 events

---

> **The single most important thing**: Send the bot a message when you feel LOW energy, stressed, or unmotivated. Everyone remembers to log good days — it's the bad days that make the model smart.
