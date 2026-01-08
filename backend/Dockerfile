# Frontend build stage
FROM node:20-alpine as frontend-builder

WORKDIR /frontend

# Copy frontend files (from project root context)
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ .

# Build frontend (API URL será a mesma origem)
ENV VITE_API_URL=""
RUN npm run build

# Python build stage
FROM python:3.11-slim as python-builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create virtual environment
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install dependencies (from backend folder)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    tesseract-ocr \
    tesseract-ocr-por \
    && rm -rf /var/lib/apt/lists/*

# Copy virtual environment from builder
COPY --from=python-builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy backend application code
COPY backend/ .

# Copy frontend build
COPY --from=frontend-builder /frontend/dist ./static

# Create directories
RUN mkdir -p uploads data

# Expose port
EXPOSE 8080

# Run migrations and start server
CMD ["sh", "-c", "echo 'Running database migrations...' && alembic upgrade head && echo 'Migrations completed!' || echo 'Migration failed, continuing anyway...' ; uvicorn app.main:app --host 0.0.0.0 --port 8080"]
