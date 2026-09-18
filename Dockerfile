FROM python:3.11-slim

WORKDIR /app

# Prevent Python from writing .pyc files and enable unbuffered logging
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOST=0.0.0.0 \
    PORT=8000

# Install dependencies (utilizing Docker layer caching)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application source code
COPY . .

# Expose HTTP port
EXPOSE 8000

# Health check probe for container readiness
HEALTHCHECK --interval=10s --timeout=5s --retries=3 \
    CMD python -c "import os, urllib.request; p=os.getenv('PORT','8000'); urllib.request.urlopen(f'http://localhost:{p}/health')" || exit 1

# Run Uvicorn web server (supports dynamic PORT injected by Railway or default 8000)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
