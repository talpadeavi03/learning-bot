FROM python:3.11-slim

WORKDIR /app

# Install system deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY scripts/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy pipeline code
COPY scripts/ ./scripts/
COPY data/ ./data/ 2>/dev/null || true

# Default: run full pipeline
CMD ["python", "-u", "scripts/pipeline/run_pipeline.py"]
