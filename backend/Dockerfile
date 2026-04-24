FROM python:3.11-slim

WORKDIR /app

# Install git for cloning repos
RUN apt-get update && apt-get install -y git && rm -rf /var/lib/apt/lists/*

# Copy requirements first for caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download sentence-transformers models to avoid startup delay
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2'); print('Models cached')"

# Copy application code
COPY . .

# Expose port (Render uses dynamic PORT env var)
EXPOSE 10000

# Run the application with faster startup
# Render sets PORT env var, default to 10000 for local
CMD uvicorn app.main:app --host 0.0.0.0 --port $PORT --timeout-keep-alive 120
