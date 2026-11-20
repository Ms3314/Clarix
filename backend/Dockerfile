# Build from the repo root:  docker build -f backend/Dockerfile .
# The app imports itself as the `backend` package, so it lives at /app/backend
# and uvicorn runs from /app.
FROM python:3.13-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr poppler-utils curl \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY backend/requirements-prod.txt /app/requirements-prod.txt
RUN pip install -r /app/requirements-prod.txt

COPY backend /app/backend

RUN useradd --create-home --uid 1000 clarix && mkdir -p /app/data && chown clarix /app/data
USER clarix

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD curl -fsS http://localhost:8000/docs > /dev/null || exit 1

# One worker: indexing is synchronous and memory-heavy, and the box is small.
# --root-path /api because Caddy strips the /api prefix before proxying.
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000", \
     "--workers", "1", "--root-path", "/api", "--proxy-headers", "--forwarded-allow-ips", "*"]
