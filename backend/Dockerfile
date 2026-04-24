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
# Use exec form and shell to properly expand PORT variable
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-10000} --timeout-keep-alive 120"]
