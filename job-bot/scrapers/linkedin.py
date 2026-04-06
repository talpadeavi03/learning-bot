"""
AETHER Job Bot — LinkedIn Scraper + Easy Apply
Uses Playwright for browser automation
"""

import os
import time
import random
import logging
import json
from typing import List, Optional
from dataclasses import dataclass

log = logging.getLogger(__name__)


@dataclass
class LinkedInJob:
    job_id:      str
    company:     str
    role:        str
    location:    str
    salary:      str
    description: str
    job_url:     str
    easy_apply:  bool
    apply_type:  str = "manual"


def _get_page(playwright_import=True):
    """Lazy import Playwright to avoid errors if not installed."""
    from playwright.sync_api import sync_playwright
    return sync_playwright


def scrape_all(max_results: int = 50) -> List[LinkedInJob]:
    """Scrape LinkedIn job search for all target roles."""
    from config import TARGET_ROLES, TARGET_LOCATIONS

    all_jobs = []
    seen_ids = set()

    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        log.error("Playwright not installed. Run: pip install playwright && playwright install chromium")
        return []

    with sync_playwright() as p:
        browser = p.chromium.launch(
            headless=True,
            args=[
                "--no-sandbox",
                "--disable-blink-features=AutomationControlled",
                "--disable-dev-shm-usage"
            ]
        )
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
            viewport={"width": 1280, "height": 900},
        )

        # Load saved session cookies (from GitHub Secrets)
        _load_linkedin_cookies(ctx)

        page = ctx.new_page()

        for role in TARGET_ROLES[:5]:  # top 5 roles
            location = "India"
            query = role.replace(" ", "%20")
            url = (
                f"https://www.linkedin.com/jobs/search/"
                f"?keywords={query}&location={location}"
                f"&f_TPR=r86400"  # Last 24h
                f"&f_AL=true"     # Easy Apply filter
                f"&sortBy=DD"     # Most recent
            )

            try:
                page.goto(url, timeout=20000)
                page.wait_for_timeout(3000)

                # Scroll to load more
                for _ in range(3):
                    page.keyboard.press("End")
                    page.wait_for_timeout(1500)

                cards = page.query_selector_all(".job-search-card")
                log.info(f"  LinkedIn [{role}]: {len(cards)} cards found")

                for card in cards[:20]:
                    try:
                        job = _parse_job_card(card)
                        if job and job.job_id not in seen_ids:
                            seen_ids.add(job.job_id)
                            all_jobs.append(job)
                    except Exception:
                        pass

                time.sleep(random.uniform(3, 7))

            except Exception as e:
                log.error(f"  LinkedIn scrape error [{role}]: {e}")

        browser.close()

    log.info(f"LinkedIn total jobs: {len(all_jobs)}")
    return all_jobs


def _parse_job_card(card) -> Optional[LinkedInJob]:
    """Extract job data from a LinkedIn job card element."""
    try:
        link_el   = card.query_selector("a.job-search-card__title-link")
        company_el = card.query_selector("a.job-search-card__company-name")
        loc_el    = card.query_selector(".job-search-card__location")
        badge_el  = card.query_selector(".job-search-card__easy-apply-label")

        href    = link_el.get_attribute("href") if link_el else ""
        job_id  = href.split("/jobs/view/")[-1].split("?")[0] if "/jobs/view/" in href else ""
        role    = link_el.inner_text().strip() if link_el else "Unknown"
        company = company_el.inner_text().strip() if company_el else "Unknown"
        location = loc_el.inner_text().strip() if loc_el else "Unknown"
        easy    = badge_el is not None

        return LinkedInJob(
            job_id=job_id,
            company=company,
            role=role,
            location=location,
            salary="Not disclosed",
            description="",
            job_url=f"https://www.linkedin.com/jobs/view/{job_id}/",
            easy_apply=easy,
            apply_type="easy" if easy else "manual"
        )
    except Exception:
        return None


def apply_linkedin_easy(job: LinkedInJob) -> dict:
    """Submit LinkedIn Easy Apply for a job."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        return {"success": False, "error": "Playwright not installed"}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True, args=["--no-sandbox"])
        ctx = browser.new_context(
            user_agent="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36"
        )
        _load_linkedin_cookies(ctx)
        page = ctx.new_page()

        try:
            page.goto(job.job_url, timeout=20000)
            page.wait_for_timeout(2000)

            # Click Easy Apply button
            easy_btn = page.query_selector("button.jobs-apply-button")
            if not easy_btn:
                return {"success": False, "error": "Easy Apply button not found"}

            easy_btn.click()
            page.wait_for_timeout(2000)

            # Handle multi-step form — click Next until Submit
            max_steps = 8
            for step in range(max_steps):
                next_btn   = page.query_selector("button[aria-label='Continue to next step']")
                review_btn = page.query_selector("button[aria-label='Review your application']")
                submit_btn = page.query_selector("button[aria-label='Submit application']")

                if submit_btn:
                    submit_btn.click()
                    page.wait_for_timeout(2000)
                    log.info(f"  ✅ LinkedIn Easy Apply submitted: {job.role} @ {job.company}")
                    browser.close()
                    return {"success": True, "site": "linkedin", "job_id": job.job_id}

                if review_btn:
                    review_btn.click()
                elif next_btn:
                    next_btn.click()
                else:
                    break

                page.wait_for_timeout(1500)

            browser.close()
            return {"success": False, "error": "Could not complete application form"}

        except Exception as e:
            browser.close()
            log.error(f"  ❌ LinkedIn apply error: {e}")
            return {"success": False, "site": "linkedin", "error": str(e)}


def _load_linkedin_cookies(ctx):
    """Load LinkedIn session cookies from GitHub Secrets env var."""
    cookies_json = os.getenv("LINKEDIN_COOKIES_JSON")
    if cookies_json:
        try:
            cookies = json.loads(cookies_json)
            ctx.add_cookies(cookies)
            log.info("  🍪 LinkedIn cookies loaded")
        except Exception as e:
            log.warning(f"  ⚠️ LinkedIn cookie load failed: {e}")
    else:
        log.warning("  ⚠️ LINKEDIN_COOKIES_JSON not set")
