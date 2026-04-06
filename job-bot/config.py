# ═══════════════════════════════════════════════════
# AETHER JOB BOT — config.py
# Edit this file to control what jobs to target
# ═══════════════════════════════════════════════════

# ── TARGET ROLES ──────────────────────────────────
TARGET_ROLES = [
    "DevOps Engineer",
    "MLOps Engineer",
    "Cloud Engineer",
    "Site Reliability Engineer",
    "Platform Engineer",
    "Linux Administrator",
    "System Administrator",
    "System Engineer",
    "Security Engineer",
]

# ── LOCATIONS ─────────────────────────────────────
TARGET_LOCATIONS = ["Pune", "Mumbai", "Bangalore", "Hyderabad", "Remote", "Hybrid"]

# ── SALARY FILTER ─────────────────────────────────
SALARY_MIN_LPA   = 12
SALARY_MAX_LPA   = 25
EXPERIENCE_YEARS = 3  # years of experience

# ── AUTO-APPLY LIMITS (safety) ────────────────────
MAX_AUTO_APPLIES_PER_DAY = 30
DELAY_BETWEEN_APPLIES_MIN = 10  # seconds
DELAY_BETWEEN_APPLIES_MAX = 25  # seconds
AUTO_APPLY_MIN_FIT_SCORE  = 7   # skip if below this
MANUAL_QUEUE_MIN_FIT_SCORE = 5  # show in manual queue if above this

# ── BLACKLIST ─────────────────────────────────────
BLACKLIST_COMPANIES = [
    "TCS", "Infosys", "Wipro", "HCL Technologies",
    "Cognizant", "Tech Mahindra", "Mphasis",
]

BLACKLIST_KEYWORDS = [
    "10+ years", "15 years", "Java only", "SAP",
    ".NET only", "mainframe", "COBOL"
]

# ── PROFILE SUMMARY (for LLM scoring) ─────────────
PROFILE_SUMMARY = """
Name: Avinash (Avi) Talpade
Experience: 3.6 years at Accenture (Azure Cloud & DevOps)
Since Aug 2025: Self-learning MLOps, ML pipelines, GitHub Actions, MLflow, DagsHub

Core Skills:
- Cloud: Azure (primary), AWS (learning), GCP basics
- IaC: Terraform, ARM Templates
- Containers: Docker, Kubernetes (basics), Helm
- CI/CD: GitHub Actions, Azure DevOps, Jenkins
- Scripting: Python, Bash, PowerShell
- OS: Linux (Ubuntu/RHEL), Windows Server
- Monitoring: Prometheus, Grafana, Azure Monitor
- ML/MLOps: MLflow, DagsHub, scikit-learn, GitHub Actions ML pipelines
- Security: IAM, RBAC, Azure Security Center basics

Targeting: DevOps / MLOps / Cloud / SRE roles in Pune/Remote
Expected CTC: 14-18 LPA
Notice Period: Immediate to 30 days
"""

# ── RESUME PATH ───────────────────────────────────
RESUME_PDF_PATH = "resume/resume.pdf"
RESUME_TXT_PATH = "resume/resume.txt"

# ── SUPABASE ──────────────────────────────────────
# Set via env var: SUPABASE_URL, SUPABASE_KEY
SUPABASE_TABLE_JOBS = "jobs"
SUPABASE_TABLE_APPLICATIONS = "applications"

# ── GMAIL ─────────────────────────────────────────
GMAIL_SEARCH_QUERY = (
    "is:unread ("
    "subject:(job OR opportunity OR hiring OR recruiter OR opening OR position OR role) "
    "OR from:(noreply@linkedin.com OR jobs@naukri.com OR jobs@monster.com)"
    ")"
)
GMAIL_MAX_RESULTS = 50

# ── SITES TO SCRAPE ───────────────────────────────
ENABLED_SCRAPERS = [
    "naukri",
    "linkedin",
    "hirist",
    "monster",
    "indeed",
    "foundit",
    "cutshort",
    "internshala",
    "iimjobs",
    "remotive",
]

# ── CLOUDFLARE WORKER (for dashboard logging) ─────
# Set via env var: WORKER_URL
WORKER_JOBS_LOG_URL = "/jobs/ingest"  # POST endpoint
