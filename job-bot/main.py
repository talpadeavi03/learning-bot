"""
AETHER Job Bot — Main Orchestrator
Runs the full pipeline: scrape → score → apply/queue → log
"""

import os
import sys
import time
import random
import logging
import json
from datetime import datetime
from supabase import create_client

from config import (
    TARGET_ROLES, TARGET_LOCATIONS,
    MAX_AUTO_APPLIES_PER_DAY,
    DELAY_BETWEEN_APPLIES_MIN, DELAY_BETWEEN_APPLIES_MAX,
    AUTO_APPLY_MIN_FIT_SCORE, MANUAL_QUEUE_MIN_FIT_SCORE
)
from pipeline.scorer import score_job
from pipeline.gmail_reader import run_gmail_pipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [AETHER-JOBS] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
log = logging.getLogger(__name__)

# ── counters ──────────────────────────────────────
stats = {
    "jobs_found":    0,
    "jobs_scored":   0,
    "auto_applied":  0,
    "manual_queued": 0,
    "skipped":       0,
    "errors":        0,
}


def get_supabase():
    return create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])


def already_applied(supabase, job_id: str, source: str) -> bool:
    """Check if we've seen this job before (dedup)."""
    res = supabase.table("jobs").select("id").eq("source", source).eq("job_id_ext", job_id).execute()
    return len(res.data) > 0


def save_job(supabase, job_data: dict, analysis: dict, apply_result: dict = None):
    """Upsert job to Supabase."""
    fit   = analysis.get("fit_score", 0)
    atype = analysis.get("apply_type", "manual")
    ap_ok = apply_result and apply_result.get("success")

    record = {
        "source":       job_data.get("source", "unknown"),
        "job_id_ext":   job_data.get("job_id", ""),
        "company":      analysis.get("company") or job_data.get("company", "Unknown"),
        "role":         analysis.get("role")    or job_data.get("role", "Unknown"),
        "location":     analysis.get("location") or job_data.get("location", "Unknown"),
        "salary":       analysis.get("salary")   or job_data.get("salary", "Not disclosed"),
        "job_type":     analysis.get("job_type", "Full-time"),
        "job_url":      job_data.get("job_url", ""),
        "description":  job_data.get("description", "")[:800],
        "fit_score":    fit,
        "fit_reason":   analysis.get("fit_reason", ""),
        "apply_type":   atype,
        "status":       "applied" if ap_ok else ("queued" if atype == "manual" else "new"),
        "applied_at":   datetime.utcnow().isoformat() if ap_ok else None,
    }

    try:
        supabase.table("jobs").upsert(record, on_conflict="source,job_id_ext").execute()
    except Exception as e:
        log.error(f"Supabase save error: {e}")
        stats["errors"] += 1


def log_to_worker(job_record: dict):
    """POST job data to Cloudflare Worker → shows in AETHER Jobs tab."""
    worker_url = os.getenv("WORKER_URL", "")
    if not worker_url:
        return

    import urllib.request
    payload = json.dumps(job_record).encode()
    req = urllib.request.Request(
        f"{worker_url}/jobs/ingest",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        urllib.request.urlopen(req, timeout=5)
    except Exception:
        pass  # Non-critical — Supabase is the source of truth


def send_telegram_alert(message: str):
    """Send Telegram notification for manual apply jobs."""
    bot_token = os.getenv("TELEGRAM_BOT_TOKEN")
    chat_id   = os.getenv("TELEGRAM_CHAT_ID")
    if not bot_token or not chat_id:
        return

    import urllib.request, urllib.parse
    url  = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    data = urllib.parse.urlencode({
        "chat_id":    chat_id,
        "text":       message,
        "parse_mode": "Markdown"
    }).encode()
    try:
        urllib.request.urlopen(url, data=data, timeout=5)
    except Exception:
        pass


def run_scrapers() -> list:
    """Run all enabled site scrapers."""
    all_jobs = []

    # Naukri
    try:
        from scrapers.naukri import scrape_all as naukri_all
        naukri_jobs = naukri_all(max_per_role=10)
        all_jobs.extend([{
            "job_id": j.job_id, "company": j.company, "role": j.role,
            "location": j.location, "salary": j.salary, "description": j.description,
            "job_url": j.job_url, "easy_apply": j.easy_apply, "source": "naukri"
        } for j in naukri_jobs])
        log.info(f"Naukri: {len(naukri_jobs)} jobs scraped")
    except Exception as e:
        log.error(f"Naukri scraper failed: {e}")

    # LinkedIn
    try:
        from scrapers.linkedin import scrape_all as linkedin_all
        li_jobs = linkedin_all(max_results=30)
        all_jobs.extend([{
            "job_id": j.job_id, "company": j.company, "role": j.role,
            "location": j.location, "salary": j.salary, "description": j.description,
            "job_url": j.job_url, "easy_apply": j.easy_apply, "source": "linkedin"
        } for j in li_jobs])
        log.info(f"LinkedIn: {len(li_jobs)} jobs scraped")
    except Exception as e:
        log.error(f"LinkedIn scraper failed: {e}")

    # Other sites (Hirist, Indeed, Remotive, Cutshort, Foundit, Wellfound)
    try:
        from scrapers.other_sites import scrape_all_other_sites
        other_jobs = scrape_all_other_sites(TARGET_ROLES)
        all_jobs.extend([{
            "job_id": j.job_id, "company": j.company, "role": j.role,
            "location": j.location, "salary": j.salary, "description": j.description,
            "job_url": j.job_url, "easy_apply": j.easy_apply, "source": j.source
        } for j in other_jobs])
        log.info(f"Other sites: {len(other_jobs)} jobs scraped")
    except Exception as e:
        log.error(f"Other sites scraper failed: {e}")

    stats["jobs_found"] = len(all_jobs)
    log.info(f"\n📋 Total jobs found: {len(all_jobs)}")
    return all_jobs


def process_job(supabase, job_data: dict, auto_apply_count: int) -> int:
    """Score and apply/queue one job. Returns updated auto_apply_count."""
    source = job_data.get("source", "unknown")
    job_id = job_data.get("job_id", "")

    # Skip duplicates
    if already_applied(supabase, job_id, source):
        return auto_apply_count

    # Score with LLM
    text = f"{job_data.get('role','')} at {job_data.get('company','')} in {job_data.get('location','')}\n{job_data.get('description','')}"
    analysis = score_job(text=text, source=source)
    stats["jobs_scored"] += 1

    fit = analysis.get("fit_score", 0)
    log.info(f"  [{source.upper()}] {job_data.get('company','?')} — {job_data.get('role','?')} | Score: {fit}/10")

    # Skip poor fits
    if fit < MANUAL_QUEUE_MIN_FIT_SCORE or analysis.get("apply_type") == "skip":
        save_job(supabase, job_data, analysis)
        stats["skipped"] += 1
        return auto_apply_count

    apply_result = None
    atype = analysis.get("apply_type", "manual")

    # Auto-apply if fit >= threshold and easy apply available and within daily limit
    if (fit >= AUTO_APPLY_MIN_FIT_SCORE
            and job_data.get("easy_apply")
            and atype == "easy"
            and auto_apply_count < MAX_AUTO_APPLIES_PER_DAY):

        apply_result = _do_auto_apply(job_data, source)
        if apply_result and apply_result.get("success"):
            auto_apply_count += 1
            stats["auto_applied"] += 1
            delay = random.uniform(DELAY_BETWEEN_APPLIES_MIN, DELAY_BETWEEN_APPLIES_MAX)
            log.info(f"  ✅ Auto-applied ({auto_apply_count}/{MAX_AUTO_APPLIES_PER_DAY}) — sleeping {delay:.0f}s")
            time.sleep(delay)
        else:
            # Fall through to manual queue
            atype = "manual"

    # Manual queue alert
    if atype == "manual" and fit >= MANUAL_QUEUE_MIN_FIT_SCORE:
        stats["manual_queued"] += 1
        if fit >= 7:
            send_telegram_alert(
                f"🎯 *High-Fit Job — Apply Now!*\n\n"
                f"*{job_data.get('role','?')}* @ {job_data.get('company','?')}\n"
                f"📍 {job_data.get('location','?')} | 💰 {job_data.get('salary','?')}\n"
                f"⭐ Fit: {fit}/10 — {analysis.get('fit_reason','')}\n\n"
                f"🔗 {job_data.get('job_url','')}"
            )

    save_job(supabase, job_data, analysis, apply_result)
    log_to_worker({**job_data, **analysis, "applied": bool(apply_result and apply_result.get("success"))})
    return auto_apply_count


def _do_auto_apply(job_data: dict, source: str) -> dict:
    """Route auto-apply to the right site handler."""
    try:
        if source == "naukri":
            from scrapers.naukri import apply_naukri, get_naukri_cookies, NaukriJob
            cookies = get_naukri_cookies()
            if not cookies:
                return {"success": False, "error": "No Naukri cookies"}
            j = NaukriJob({
                "jobId": job_data["job_id"], "companyName": job_data["company"],
                "title": job_data["role"], "placeholders": [], "jobDescription": ""
            })
            return apply_naukri(j, cookies)

        elif source == "linkedin":
            from scrapers.linkedin import apply_linkedin_easy, LinkedInJob
            j = LinkedInJob(
                job_id=job_data["job_id"], company=job_data["company"],
                role=job_data["role"], location=job_data["location"],
                salary=job_data["salary"], description=job_data["description"],
                job_url=job_data["job_url"], easy_apply=True
            )
            return apply_linkedin_easy(j)

    except Exception as e:
        log.error(f"  Auto-apply error [{source}]: {e}")
        return {"success": False, "error": str(e)}

    return {"success": False, "error": f"No auto-apply handler for {source}"}


def log_pipeline_run(supabase, duration: int):
    """Save pipeline run summary to Supabase."""
    try:
        supabase.table("pipeline_runs").insert({
            **stats, "duration_secs": duration,
            "notes": f"Roles: {', '.join(TARGET_ROLES[:3])}..."
        }).execute()
    except Exception as e:
        log.error(f"Pipeline run log failed: {e}")


def main():
    log.info("╔══════════════════════════════════════╗")
    log.info("║    AETHER Job Bot — Pipeline Start   ║")
    log.info("╚══════════════════════════════════════╝")

    start = time.time()
    supabase = get_supabase()

    # Phase 1: Gmail
    log.info("\n━━━ Phase 1: Gmail Reader ━━━")
    try:
        gmail_stats = run_gmail_pipeline()
        stats["jobs_found"] += gmail_stats.get("saved", 0)
    except Exception as e:
        log.error(f"Gmail pipeline failed: {e}")
        stats["errors"] += 1

    # Phase 2: Scrape sites
    log.info("\n━━━ Phase 2: Job Scraping ━━━")
    all_jobs = run_scrapers()

    # Phase 3: Score + Apply
    log.info("\n━━━ Phase 3: Score + Apply ━━━")
    auto_apply_count = 0
    for job_data in all_jobs:
        try:
            auto_apply_count = process_job(supabase, job_data, auto_apply_count)
        except Exception as e:
            log.error(f"Job processing error: {e}")
            stats["errors"] += 1

    # Summary
    duration = int(time.time() - start)
    log.info(f"\n╔══════════════════════════════════════╗")
    log.info(f"║         Pipeline Complete            ║")
    log.info(f"╠══════════════════════════════════════╣")
    log.info(f"║  Found:        {stats['jobs_found']:>4}                  ║")
    log.info(f"║  Scored:       {stats['jobs_scored']:>4}                  ║")
    log.info(f"║  Auto-applied: {stats['auto_applied']:>4}                  ║")
    log.info(f"║  Manual queue: {stats['manual_queued']:>4}                  ║")
    log.info(f"║  Skipped:      {stats['skipped']:>4}                  ║")
    log.info(f"║  Errors:       {stats['errors']:>4}                  ║")
    log.info(f"║  Duration:     {duration:>3}s                   ║")
    log.info(f"╚══════════════════════════════════════╝")

    log_pipeline_run(supabase, duration)


if __name__ == "__main__":
    main()
