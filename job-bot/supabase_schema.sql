-- ═══════════════════════════════════════════════
-- AETHER JOB BOT — Supabase Schema
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════

-- Jobs discovered from any source
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source        TEXT NOT NULL,        -- 'naukri','linkedin','gmail','hirist',etc
  job_id_ext    TEXT,                 -- site's own job ID (for dedup)
  company       TEXT,
  role          TEXT,
  location      TEXT,
  salary        TEXT,
  experience    TEXT,
  job_type      TEXT,                 -- 'full-time','contract','remote'
  job_url       TEXT,
  description   TEXT,
  fit_score     INTEGER DEFAULT 0,   -- 1-10 from LLM
  fit_reason    TEXT,
  apply_type    TEXT DEFAULT 'manual', -- 'easy','manual','skip'
  status        TEXT DEFAULT 'new',  -- 'new','queued','applied','rejected','interview','offer'
  applied_at    TIMESTAMPTZ,
  response_at   TIMESTAMPTZ,
  notes         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, job_id_ext)          -- prevent duplicate applications
);

-- Each application attempt log
CREATE TABLE IF NOT EXISTS applications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id        UUID REFERENCES jobs(id) ON DELETE CASCADE,
  attempt_type  TEXT,                 -- 'auto','manual','email_reply'
  site          TEXT,
  status        TEXT,                 -- 'success','failed','pending'
  error_msg     TEXT,
  resume_used   TEXT,                 -- filename of resume used
  cover_letter  TEXT,                 -- generated cover letter if any
  applied_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Daily pipeline run summary
CREATE TABLE IF NOT EXISTS pipeline_runs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at        TIMESTAMPTZ DEFAULT NOW(),
  jobs_found    INTEGER DEFAULT 0,
  jobs_scored   INTEGER DEFAULT 0,
  auto_applied  INTEGER DEFAULT 0,
  manual_queued INTEGER DEFAULT 0,
  skipped       INTEGER DEFAULT 0,
  errors        INTEGER DEFAULT 0,
  duration_secs INTEGER,
  notes         TEXT
);

-- Indexes for dashboard queries
CREATE INDEX IF NOT EXISTS idx_jobs_status    ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_source    ON jobs(source);
CREATE INDEX IF NOT EXISTS idx_jobs_fit_score ON jobs(fit_score DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_created   ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_apps_job_id    ON applications(job_id);

-- View: today's pipeline summary
CREATE OR REPLACE VIEW daily_summary AS
SELECT
  status,
  source,
  COUNT(*) as count,
  AVG(fit_score) as avg_score
FROM jobs
WHERE created_at >= CURRENT_DATE
GROUP BY status, source;

-- Enable Row Level Security (optional but recommended)
ALTER TABLE jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_runs ENABLE ROW LEVEL SECURITY;
