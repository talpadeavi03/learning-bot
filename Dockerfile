FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy dependencies
COPY requirements-ml.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt || true

# Copy source code and scripts
COPY api/ ./api/
COPY scripts/ ./scripts/
COPY site/ ./site/
COPY data/ ./data/ 2>/dev/null || true

# Expose FastAPI serving port
EXPOSE 8000

# Default: Execute unified master parallel MLOps pipeline
CMD ["python", "-u", "scripts/pipeline/run_parallel_pipeline.py"]
