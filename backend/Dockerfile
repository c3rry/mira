# multi-stage python runtime for mira backend orchestrator
FROM python:3.11-slim

# configure python environment invariants
ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# install system dependencies for opencv and network checks
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    libgl1 \
    libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*

# install python dependencies
RUN pip install --upgrade pip && \
    pip install \
    google-genai>=0.7.0 \
    fastapi==0.110.0 \
    uvicorn[standard]==0.28.0 \
    pydantic==2.6.4 \
    httpx==0.27.0 \
    opencv-python-headless==4.9.0.80 \
    trimesh \
    python-dotenv \
    pytest \
    pytest-asyncio \
    pytest-mock \
    pillow \
    numpy

# copy application code and shared contracts
COPY backend /app/backend
COPY shared /app/shared

EXPOSE 8000

# start fastapi service
CMD ["python", "-m", "uvicorn", "backend.app.main:app", "--host", "0.0.0.0", "--port", "8000"]
