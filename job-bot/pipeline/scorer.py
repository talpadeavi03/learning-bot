"""
AETHER Job Bot — LLM Scorer
Uses Cloudflare AI (Llama 3) or Claude API to score job fit
"""

import os
import json
import logging
import re
import anthropic

from config import PROFILE_SUMMARY, BLACKLIST_COMPANIES, BLACKLIST_KEYWORDS

log = logging.getLogger(__name__)


SYSTEM_PROMPT = f"""You are a job fit analyzer for Avi Talpade, a DevOps/MLOps/Cloud Engineer.

PROFILE:
{PROFILE_SUMMARY}

Analyze job postings and respond ONLY in valid JSON — no markdown, no extra text.
Use EXACTLY this schema:
{{
  "is_job_email": true,
  "company": "Company name",
  "role": "Exact job title",
  "location": "City or Remote",
  "salary": "Salary if mentioned, else Not mentioned",
  "job_type": "Full-time / Contract / Remote",
  "experience_required": "X years",
  "fit_score": 8,
  "fit_reason": "One sentence why this is or isn't a fit",
  "missing_skills": ["skill1", "skill2"],
  "apply_type": "easy",
  "reply_email": "Short professional reply if score >= 7, else empty string"
}}

Scoring guide:
- 8-10: Strong match (DevOps/MLOps/Cloud, Azure/AWS, CI-CD, Python, Terraform)
- 5-7:  Partial match (related but some gaps)
- 1-4:  Poor match (Java only, SAP, 10+ years needed, irrelevant domain)

apply_type options:
- "easy"   → site has one-click/quick apply
- "manual" → needs full application form
- "skip"   → poor fit, don't apply
"""


def score_job(text: str, subject: str = "", source: str = "unknown") -> dict:
    """Score a job posting using Claude API (primary) or fallback."""

    # Quick blacklist check BEFORE calling API (save cost)
    text_lower = (text + " " + subject).lower()
    for company in BLACKLIST_COMPANIES:
        if company.lower() in text_lower:
            log.info(f"  🚫 Blacklisted company detected: {company}")
            return {"is_job_email": True, "company": company, "fit_score": 0,
                    "fit_reason": "Blacklisted company", "apply_type": "skip",
                    "role": "Unknown", "location": "Unknown", "salary": "Unknown",
                    "job_type": "Unknown", "experience_required": "",
                    "missing_skills": [], "reply_email": ""}

    for kw in BLACKLIST_KEYWORDS:
        if kw.lower() in text_lower:
            log.info(f"  🚫 Blacklisted keyword: {kw}")
            return {"is_job_email": True, "company": "Unknown", "fit_score": 1,
                    "fit_reason": f"Blacklisted keyword: {kw}", "apply_type": "skip",
                    "role": "Unknown", "location": "Unknown", "salary": "Unknown",
                    "job_type": "Unknown", "experience_required": "",
                    "missing_skills": [], "reply_email": ""}

    # Try Claude API first
    api_key = os.getenv("CLAUDE_API_KEY") or os.getenv("ANTHROPIC_API_KEY")
    if api_key:
        return _score_with_claude(text, subject, api_key)

    # Fallback: Cloudflare Worker
    worker_url = os.getenv("WORKER_URL")
    if worker_url:
        return _score_via_worker(text, subject, worker_url)

    # Last resort: regex extraction
    log.warning("No AI API available — using regex fallback")
    return _score_regex_fallback(text, subject)


def _score_with_claude(text: str, subject: str, api_key: str) -> dict:
    """Score using Claude claude-sonnet-4-5 — best quality."""
    try:
        client = anthropic.Anthropic(api_key=api_key)
        prompt = f"Subject: {subject}\n\nJob posting:\n{text[:3000]}"

        response = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=800,
            system=SYSTEM_PROMPT,
            messages=[{"role": "user", "content": prompt}]
        )

        raw = response.content[0].text.strip()
        return _parse_json(raw)

    except Exception as e:
        log.error(f"Claude API error: {e}")
        return _score_regex_fallback(text, subject)


def _score_via_worker(text: str, subject: str, worker_url: str) -> dict:
    """Score via Cloudflare Worker Llama 3 endpoint."""
    import urllib.request
    payload = json.dumps({"email_body": text, "subject": subject}).encode()
    req = urllib.request.Request(
        f"{worker_url}/jobs/analyze",
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return json.loads(resp.read().decode())
    except Exception as e:
        log.error(f"Worker scoring error: {e}")
        return _score_regex_fallback(text, subject)


def _parse_json(raw: str) -> dict:
    """Parse JSON from LLM response, handling markdown code blocks."""
    clean = re.sub(r"```json\n?", "", raw)
    clean = re.sub(r"```\n?", "", clean).strip()
    try:
        return json.loads(clean)
    except json.JSONDecodeError:
        log.warning("JSON parse failed — using regex fallback")
        return _score_regex_fallback(raw, "")


def _score_regex_fallback(text: str, subject: str) -> dict:
    """Basic regex extraction when no AI is available."""
    combined = (text + " " + subject).lower()

    # Detect if it's a job email at all
    job_keywords = ["job", "role", "position", "hiring", "opportunity", "opening", "apply", "recruiter"]
    is_job = any(kw in combined for kw in job_keywords)

    # Basic fit scoring
    match_keywords = ["devops", "mlops", "cloud", "azure", "aws", "terraform",
                      "kubernetes", "docker", "python", "ci/cd", "sre", "linux",
                      "platform", "infrastructure", "automation", "ansible"]
    matches = sum(1 for kw in match_keywords if kw in combined)
    fit_score = min(10, max(1, matches * 2))

    # Extract company (rough)
    company_match = re.search(r'(?:at|@|from|company[:\s]+)([A-Z][A-Za-z\s&]+)', text)
    company = company_match.group(1).strip()[:40] if company_match else "Unknown"

    return {
        "is_job_email":       is_job,
        "company":            company,
        "role":               "Unknown",
        "location":           "Unknown",
        "salary":             "Not mentioned",
        "job_type":           "Unknown",
        "experience_required": "",
        "fit_score":          fit_score,
        "fit_reason":         f"Regex match: {matches} relevant keywords found",
        "missing_skills":     [],
        "apply_type":         "manual" if fit_score >= 5 else "skip",
        "reply_email":        "",
    }
