"""
AETHER Job Bot — Naukri Scraper
Searches Naukri.com and submits Quick Apply
"""

import os
import time
import random
import logging
import requests
from bs4 import BeautifulSoup
from typing import List, Optional

from config import TARGET_ROLES, TARGET_LOCATIONS, EXPERIENCE_YEARS, RESUME_PDF_PATH

log = logging.getLogger(__name__)

# Naukri uses a semi-public REST API — these headers mimic the mobile app
NAUKRI_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebkit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
    "Accept": "application/json",
    "appid": "109",       # Naukri's internal app ID
    "systemid": "Naukri",
}


class NaukriJob:
    def __init__(self, raw: dict):
        self.job_id      = raw.get("jobId", "")
        self.company     = raw.get("companyName", "Unknown")
        self.role        = raw.get("title", "Unknown")
        self.location    = ", ".join(raw.get("placeholders", [{}])[0].get("label", "").split(",")[:2])
        self.salary      = raw.get("placeholders", [{}, {}])[1].get("label", "Not disclosed") if len(raw.get("placeholders", [])) > 1 else "Not disclosed"
        self.experience  = raw.get("placeholders", [{}])[0].get("label", "") if raw.get("placeholders") else ""
        self.description = raw.get("jobDescription", "")[:1000]
        self.job_url     = f"https://www.naukri.com/{raw.get('jobId', '')}"
        self.tags        = raw.get("tagsAndSkills", "")
        self.easy_apply  = raw.get("staticUrl", "").endswith("/quick-apply") or "quickapply" in raw.get("moreDetails", {}).get("applyButton", {}).get("url", "").lower()


def search_naukri(role: str, location: str = "India", pages: int = 3) -> List[NaukriJob]:
    """Search Naukri for a specific role."""
    jobs = []
    keyword = role.replace(" ", "-").lower()
    loc_key = location.lower()

    for page in range(1, pages + 1):
        url = (
            f"https://www.naukri.com/jobapi/v4/search"
            f"?noOfResults=20&urlType=search_by_keyword"
            f"&searchType=adv&keyword={keyword}"
            f"&location={loc_key}&experience={EXPERIENCE_YEARS}"
            f"&k={keyword}&l={loc_key}&pageNo={page}"
        )
        try:
            resp = requests.get(url, headers=NAUKRI_HEADERS, timeout=10)
            if resp.status_code == 200:
                data = resp.json()
                raw_jobs = data.get("jobDetails", [])
                for rj in raw_jobs:
                    jobs.append(NaukriJob(rj))
                log.info(f"  Naukri [{role}] page {page}: {len(raw_jobs)} jobs")
            else:
                log.warning(f"  Naukri search failed: HTTP {resp.status_code}")
        except Exception as e:
            log.error(f"  Naukri error: {e}")

        time.sleep(random.uniform(2, 5))

    return jobs


def apply_naukri(job: NaukriJob, session_cookies: dict) -> dict:
    """Submit Quick Apply on Naukri using stored session cookies."""
    apply_url = f"https://www.naukri.com/jobapi/v4/job/{job.job_id}/apply"
    headers = {**NAUKRI_HEADERS, "Content-Type": "application/json"}

    try:
        resp = requests.post(
            apply_url,
            headers=headers,
            cookies=session_cookies,
            json={"jobId": job.job_id},
            timeout=15
        )
        if resp.status_code in (200, 201):
            log.info(f"  ✅ Applied via Naukri QuickApply: {job.role} @ {job.company}")
            return {"success": True, "site": "naukri", "job_id": job.job_id}
        else:
            log.warning(f"  ⚠️ Naukri apply returned {resp.status_code} for {job.job_id}")
            return {"success": False, "site": "naukri", "error": f"HTTP {resp.status_code}"}
    except Exception as e:
        log.error(f"  ❌ Naukri apply error: {e}")
        return {"success": False, "site": "naukri", "error": str(e)}


def get_naukri_cookies() -> Optional[dict]:
    """Get Naukri session cookies from environment (set via GitHub Secrets)."""
    cookies_json = os.getenv("NAUKRI_COOKIES_JSON")
    if not cookies_json:
        log.warning("NAUKRI_COOKIES_JSON not set — manual apply only")
        return None
    import json
    return json.loads(cookies_json)


def scrape_all(max_per_role: int = 20) -> List[NaukriJob]:
    """Scrape Naukri for all target roles × locations."""
    all_jobs = []
    seen_ids = set()

    for role in TARGET_ROLES:
        for location in TARGET_LOCATIONS[:3]:  # top 3 locations
            jobs = search_naukri(role, location)
            for job in jobs:
                if job.job_id not in seen_ids:
                    seen_ids.add(job.job_id)
                    all_jobs.append(job)
                if len(all_jobs) >= max_per_role * len(TARGET_ROLES):
                    break

    log.info(f"Naukri total unique jobs found: {len(all_jobs)}")
    return all_jobs
