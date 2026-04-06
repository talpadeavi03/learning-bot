"""
AETHER Job Bot — Hirist, Monster, Indeed, Cutshort, Remotive Scrapers
Lighter scrapers for sites with cleaner APIs
"""

import os
import time
import random
import logging
import requests
from typing import List
from dataclasses import dataclass

log = logging.getLogger(__name__)


@dataclass
class Job:
    job_id:      str
    company:     str
    role:        str
    location:    str
    salary:      str
    description: str
    job_url:     str
    easy_apply:  bool
    source:      str
    apply_type:  str = "manual"


# ═══════════════════════════════════════════════════
# HIRIST (Tech jobs India — clean API)
# ═══════════════════════════════════════════════════
def scrape_hirist(role: str, max_results: int = 20) -> List[Job]:
    """Scrape Hirist.tech using their search API."""
    jobs = []
    url = "https://www.hirist.tech/api/v1/jobs"
    params = {
        "title":      role,
        "location":   "India",
        "experience": "3-5",
        "page":       1,
        "pagesize":   max_results
    }
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36",
        "Referer":    "https://www.hirist.tech/",
    }

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code == 200:
            data = resp.json()
            for item in data.get("data", {}).get("jobList", []):
                jobs.append(Job(
                    job_id=str(item.get("id", "")),
                    company=item.get("companyName", "Unknown"),
                    role=item.get("title", role),
                    location=item.get("location", "India"),
                    salary=item.get("salaryRange", "Not disclosed"),
                    description=item.get("description", "")[:500],
                    job_url=f"https://www.hirist.tech/j/{item.get('id', '')}",
                    easy_apply=True,  # Hirist has quick apply
                    source="hirist",
                    apply_type="easy"
                ))
            log.info(f"  Hirist [{role}]: {len(jobs)} jobs")
    except Exception as e:
        log.error(f"  Hirist error [{role}]: {e}")

    return jobs


# ═══════════════════════════════════════════════════
# INDEED INDIA (RSS feed — most stable)
# ═══════════════════════════════════════════════════
def scrape_indeed(role: str, location: str = "India", max_results: int = 20) -> List[Job]:
    """Scrape Indeed via their RSS feed (most stable method)."""
    import xml.etree.ElementTree as ET
    jobs = []

    query = role.replace(" ", "+")
    loc   = location.replace(" ", "+")
    url   = f"https://in.indeed.com/rss?q={query}&l={loc}&sort=date&limit={max_results}"
    headers = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0 Safari/537.36"}

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        root = ET.fromstring(resp.text)

        for item in root.findall(".//item")[:max_results]:
            title   = item.findtext("title", "Unknown")
            company = title.split(" - ")[-1].strip() if " - " in title else "Unknown"
            role_t  = title.split(" - ")[0].strip() if " - " in title else title
            link    = item.findtext("link", "")
            desc    = item.findtext("description", "")[:400]
            job_id  = link.split("jk=")[-1].split("&")[0] if "jk=" in link else link[-20:]

            jobs.append(Job(
                job_id=job_id, company=company, role=role_t,
                location=location, salary="Not disclosed",
                description=desc, job_url=link,
                easy_apply=False, source="indeed", apply_type="manual"
            ))

        log.info(f"  Indeed [{role}]: {len(jobs)} jobs")
    except Exception as e:
        log.error(f"  Indeed error [{role}]: {e}")

    return jobs


# ═══════════════════════════════════════════════════
# REMOTIVE (Remote tech jobs — free API)
# ═══════════════════════════════════════════════════
def scrape_remotive(role: str) -> List[Job]:
    """Scrape Remotive.com — free public API, no auth needed."""
    jobs = []
    url  = "https://remotive.com/api/remote-jobs"
    params = {"search": role, "limit": 20, "category": "devops-sysadmin"}

    try:
        resp = requests.get(url, params=params, timeout=10)
        if resp.status_code == 200:
            for item in resp.json().get("jobs", []):
                jobs.append(Job(
                    job_id=str(item["id"]),
                    company=item.get("company_name", "Unknown"),
                    role=item.get("title", role),
                    location=item.get("candidate_required_location", "Remote"),
                    salary=item.get("salary", "Not disclosed"),
                    description=item.get("description", "")[:500],
                    job_url=item.get("url", ""),
                    easy_apply=False,
                    source="remotive",
                    apply_type="manual"
                ))
        log.info(f"  Remotive [{role}]: {len(jobs)} jobs")
    except Exception as e:
        log.error(f"  Remotive error: {e}")

    return jobs


# ═══════════════════════════════════════════════════
# CUTSHORT (startup jobs India — public API)
# ═══════════════════════════════════════════════════
def scrape_cutshort(role: str) -> List[Job]:
    """Scrape Cutshort.io via their public job API."""
    jobs = []
    url = "https://cutshort.io/api/public/jobs"
    params = {
        "query":      role,
        "location":   "Pune,Mumbai,Bangalore",
        "experience": "3-5",
        "page":       1,
        "limit":      20
    }
    headers = {
        "Accept": "application/json",
        "Origin": "https://cutshort.io",
        "Referer": "https://cutshort.io/jobs",
    }

    try:
        resp = requests.get(url, params=params, headers=headers, timeout=10)
        if resp.status_code == 200:
            for item in resp.json().get("data", []):
                jobs.append(Job(
                    job_id=str(item.get("_id", "")),
                    company=item.get("company", {}).get("name", "Unknown"),
                    role=item.get("title", role),
                    location=", ".join(item.get("locations", ["Unknown"])),
                    salary=f"{item.get('salaryMin','?')}-{item.get('salaryMax','?')} LPA",
                    description=item.get("description", "")[:500],
                    job_url=f"https://cutshort.io/job/{item.get('_id','')}",
                    easy_apply=True,
                    source="cutshort",
                    apply_type="easy"
                ))
        log.info(f"  Cutshort [{role}]: {len(jobs)} jobs")
    except Exception as e:
        log.error(f"  Cutshort error: {e}")

    return jobs


# ═══════════════════════════════════════════════════
# WELLFOUND / ANGELLIST (startup remote jobs)
# ═══════════════════════════════════════════════════
def scrape_wellfound(role: str) -> List[Job]:
    """Scrape Wellfound.com (AngelList) listing page."""
    jobs = []
    slug = role.lower().replace(" ", "-")
    url  = f"https://wellfound.com/role/r/{slug}"
    headers = {
        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/120.0.0.0",
        "Accept": "text/html",
    }

    try:
        resp = requests.get(url, headers=headers, timeout=12)
        if resp.status_code == 200:
            # Parse listing from page metadata (Wellfound embeds JSON-LD)
            import re
            matches = re.findall(r'"jobPostingId":"(\w+)".*?"title":"([^"]+)".*?"hiringOrganization":\{"name":"([^"]+)"', resp.text)
            for match in matches[:15]:
                jid, title, company = match
                jobs.append(Job(
                    job_id=jid, company=company, role=title,
                    location="Remote/India", salary="Not disclosed",
                    description="", job_url=f"https://wellfound.com/jobs/{jid}",
                    easy_apply=False, source="wellfound", apply_type="manual"
                ))
        log.info(f"  Wellfound [{role}]: {len(jobs)} jobs")
    except Exception as e:
        log.error(f"  Wellfound error: {e}")

    return jobs


# ═══════════════════════════════════════════════════
# FOUNDIT (Monster India rebranded)
# ═══════════════════════════════════════════════════
def scrape_foundit(role: str) -> List[Job]:
    """Scrape Foundit.in (Monster India) search API."""
    jobs = []
    url = "https://www.foundit.in/middleware/jobsearch/v2/search"
    payload = {
        "query":        role,
        "locations":    ["Pune", "Mumbai", "Bangalore"],
        "experienceMin": 2,
        "experienceMax": 6,
        "start":        0,
        "rows":         20,
        "sort":         "date"
    }
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Origin": "https://www.foundit.in",
        "Referer": "https://www.foundit.in/"
    }

    try:
        resp = requests.post(url, json=payload, headers=headers, timeout=10)
        if resp.status_code == 200:
            for item in resp.json().get("jobSearchResponse", {}).get("data", []):
                jobs.append(Job(
                    job_id=str(item.get("jobId", "")),
                    company=item.get("companyName", "Unknown"),
                    role=item.get("jobTitle", role),
                    location=item.get("locationName", "Unknown"),
                    salary=item.get("ctc", "Not disclosed"),
                    description=item.get("jobDescription", "")[:400],
                    job_url=f"https://www.foundit.in/job/{item.get('jobId','')}",
                    easy_apply=item.get("easyApply", False),
                    source="foundit",
                    apply_type="easy" if item.get("easyApply") else "manual"
                ))
        log.info(f"  Foundit [{role}]: {len(jobs)} jobs")
    except Exception as e:
        log.error(f"  Foundit error: {e}")

    return jobs


def scrape_all_other_sites(roles: List[str]) -> List[Job]:
    """Run all non-Naukri/LinkedIn scrapers."""
    all_jobs = []
    seen_ids = set()

    scrapers = [
        ("hirist",    scrape_hirist),
        ("indeed",    scrape_indeed),
        ("remotive",  scrape_remotive),
        ("cutshort",  scrape_cutshort),
        ("foundit",   scrape_foundit),
        ("wellfound", scrape_wellfound),
    ]

    for role in roles[:5]:
        for name, fn in scrapers:
            try:
                jobs = fn(role)
                for j in jobs:
                    uid = f"{j.source}:{j.job_id}"
                    if uid not in seen_ids:
                        seen_ids.add(uid)
                        all_jobs.append(j)
                time.sleep(random.uniform(1.5, 3.5))
            except Exception as e:
                log.error(f"  {name} scraper failed for [{role}]: {e}")

    log.info(f"Other sites total: {len(all_jobs)} jobs")
    return all_jobs
