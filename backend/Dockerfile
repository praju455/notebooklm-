FROM python:3.11-slim

WORKDIR /app

# Install git for cloning repos
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .

# Install dependencies without sentence-transformers (too large for free tier)
RUN pip install --no-cache-dir -r requirements.txt || true

# Copy application code
COPY . .

# Expose port (Render uses dynamic PORT env var)
EXPOSE 10000

# Run the application
# Render sets PORT env var, default to 10000 for local
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --timeout-keep-alive 120
