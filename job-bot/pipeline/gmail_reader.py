"""
AETHER Job Bot — Gmail Reader Pipeline
Reads unread job emails → scores with LLM → saves to Supabase
"""

import os
import base64
import json
import time
import logging
from datetime import datetime

try:
    from google.auth.transport.requests import Request
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from googleapiclient.discovery import build
except ImportError:
    Request = None
    Credentials = None
    InstalledAppFlow = None
    build = None

try:
    from supabase import create_client, Client
except ImportError:
    create_client = None
    Client = None

from config import GMAIL_SEARCH_QUERY, GMAIL_MAX_RESULTS
from pipeline.scorer import score_job

logging.basicConfig(level=logging.INFO, format="%(asctime)s [GMAIL] %(message)s")
log = logging.getLogger(__name__)

SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]


def get_gmail_service():
    """Authenticate and return Gmail API service."""
    if not build or not Credentials:
        log.warning("Google API client packages not installed — skipping Gmail service.")
        return None

    creds = None

    # Try token from env var first (for GitHub Actions)
    token_json = os.getenv("GMAIL_TOKEN_JSON")
    if token_json:
        import tempfile
        try:
            with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as f:
                f.write(token_json)
                token_path = f.name
            creds = Credentials.from_authorized_user_file(token_path, SCOPES)
        except Exception as e:
            log.warning(f"Failed to load GMAIL_TOKEN_JSON: {e}")
    elif os.path.exists("token.json"):
        try:
            creds = Credentials.from_authorized_user_file("token.json", SCOPES)
        except Exception as e:
            log.warning(f"Failed to load token.json: {e}")

    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token and Request:
            try:
                creds.refresh(Request())
            except Exception as e:
                log.warning(f"Failed to refresh Gmail creds: {e}")
                return None
        elif os.path.exists("credentials.json") and InstalledAppFlow:
            try:
                flow = InstalledAppFlow.from_client_secrets_file("credentials.json", SCOPES)
                creds = flow.run_local_server(port=0)
                with open("token.json", "w") as f:
                    f.write(creds.to_json())
            except Exception as e:
                log.warning(f"InstalledAppFlow failed: {e}")
                return None
        else:
            return None

    try:
        return build("gmail", "v1", credentials=creds)
    except Exception as e:
        log.warning(f"Failed to build gmail service: {e}")
        return None


def get_unread_job_emails(service, max_results=50):
    """Fetch unread job-related emails."""
    result = service.users().messages().list(
        userId="me",
        q=GMAIL_SEARCH_QUERY,
        maxResults=max_results
    ).execute()
    messages = result.get("messages", [])
    log.info(f"Found {len(messages)} unread job emails")
    return messages


def extract_email_content(service, msg_id):
    """Extract subject, sender, and body from an email."""
    msg = service.users().messages().get(
        userId="me", id=msg_id, format="full"
    ).execute()

    headers = {h["name"]: h["value"] for h in msg["payload"]["headers"]}
    subject = headers.get("Subject", "No Subject")
    sender  = headers.get("From", "Unknown")
    sender_email = sender.split("<")[-1].replace(">", "").strip()

    body = _extract_body(msg["payload"])

    return {
        "id":           msg_id,
        "subject":      subject,
        "sender":       sender,
        "sender_email": sender_email,
        "body":         body[:3000],  # cap for LLM
        "date":         headers.get("Date", ""),
    }


def _extract_body(payload):
    """Recursively extract plain text body from email payload."""
    if "parts" in payload:
        for part in payload["parts"]:
            if part["mimeType"] == "text/plain":
                data = part["body"].get("data", "")
                if data:
                    return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
            # Recurse into nested multipart
            if "parts" in part:
                result = _extract_body(part)
                if result:
                    return result
    elif "body" in payload:
        data = payload["body"].get("data", "")
        if data:
            return base64.urlsafe_b64decode(data).decode("utf-8", errors="ignore")
    return ""


def mark_processed(service, msg_id):
    """Mark email as read and add 'AETHER-Processed' label."""
    service.users().messages().modify(
        userId="me",
        id=msg_id,
        body={"removeLabelIds": ["UNREAD"]}
    ).execute()


def save_to_supabase(supabase: Client, email: dict, analysis: dict):
    """Save scored job to Supabase jobs table."""
    if not analysis.get("is_job_email"):
        return None

    record = {
        "source":      "gmail",
        "job_id_ext":  email["id"],  # gmail message ID as dedup key
        "company":     analysis.get("company", "Unknown"),
        "role":        analysis.get("role", "Unknown"),
        "location":    analysis.get("location", "Unknown"),
        "salary":      analysis.get("salary", "Not mentioned"),
        "job_type":    analysis.get("job_type", "Unknown"),
        "fit_score":   analysis.get("fit_score", 0),
        "fit_reason":  analysis.get("fit_reason", ""),
        "apply_type":  "email_reply",
        "status":      "new",
        "notes":       f"From: {email['sender']}\nSubject: {email['subject']}",
    }

    try:
        result = supabase.table("jobs").upsert(
            record, on_conflict="source,job_id_ext"
        ).execute()
        log.info(f"  ✅ Saved to Supabase: {record['company']} — {record['role']}")
        return result
    except Exception as e:
        log.error(f"  ❌ Supabase error: {e}")
        return None


def run_gmail_pipeline():
    """Main Gmail reader pipeline."""
    log.info("═══ Gmail Reader Pipeline Starting ═══")

    # Init services
    gmail = get_gmail_service()
    if not gmail:
        log.info("Gmail service not available (credentials or dependencies missing) — skipping Gmail phase.")
        return {"processed": 0, "saved": 0, "not_job": 0, "errors": 0}

    supabase = None
    if create_client and os.environ.get("SUPABASE_URL") and os.environ.get("SUPABASE_KEY"):
        try:
            supabase = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_KEY"])
        except Exception as e:
            log.warning(f"Could not connect to Supabase: {e}")

    messages = get_unread_job_emails(gmail, GMAIL_MAX_RESULTS)
    processed   = 0
    saved       = 0
    not_job     = 0
    errors      = 0

    for msg in messages:
        try:
            email    = extract_email_content(gmail, msg["id"])
            log.info(f"📧 Processing: {email['subject'][:70]}...")

            analysis = score_job(
                text=email["body"],
                subject=email["subject"],
                source="gmail"
            )

            if analysis.get("is_job_email"):
                result = save_to_supabase(supabase, email, analysis)
                if result:
                    saved += 1
                    log.info(
                        f"  🏢 {analysis['company']} | {analysis['role']} "
                        f"| Score: {analysis['fit_score']}/10"
                    )
            else:
                not_job += 1
                log.info("  ⏭️  Not a job email — skipping")

            mark_processed(gmail, msg["id"])
            processed += 1
            time.sleep(0.5)  # small delay to avoid rate limit

        except Exception as e:
            errors += 1
            log.error(f"  ❌ Error processing {msg['id']}: {e}")

    log.info(f"\n═══ Gmail Pipeline Done ═══")
    log.info(f"  Processed: {processed} | Saved: {saved} | Not job: {not_job} | Errors: {errors}")
    return {"processed": processed, "saved": saved, "not_job": not_job, "errors": errors}


if __name__ == "__main__":
    run_gmail_pipeline()
