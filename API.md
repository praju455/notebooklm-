# API Reference

Complete API documentation for the Neuron backend.

**Base URL (local):** `http://localhost:8000`

**Interactive Documentation:**
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## Table of Contents

- [Health & Status](#health--status)
- [Authentication](#authentication)
- [Document Ingestion](#document-ingestion)
- [Query & Chat](#query--chat)
- [Source Management](#source-management)
- [Model Settings](#model-settings)
- [Conversations](#conversations)
- [Analytics](#analytics)

---

## Health & Status

### Get Root Info
```http
GET /
```

Returns basic connectivity and version information.

**Response:**
```json
{
  "message": "RAG Study Assistant API is running",
  "status": "online",
  "version": "2.0.0",
  "docs_url": "/docs"
}
```

### Health Check
```http
GET /health
```

Returns detailed health status and initialization state.

**Response (Healthy):**
```json
{
  "status": "healthy",
  "init_status": "ready",
  "version": "2.0.0",
  "vector_store": "connected",
  "data_retention_hours": 1
}
```

**Response (Initializing):**
```json
{
  "status": "initializing",
  "message": "RAG engine is starting up..."
}
```

---

## Authentication

### Get Auth Configuration
```http
GET /auth/config
```

Returns authentication configuration.

**Response:**
```json
{
  "google_client_id": "your-client-id.apps.googleusercontent.com",
  "auth_enabled": true
}
```

### Get Current User
```http
GET /auth/me
```

**Headers:**
- `Authorization: Bearer <token>` (optional)
- `X-User-ID: <user_id>` (optional)

**Response:**
```json
{
  "user_id": "user123",
  "email": "user@example.com",
  "name": "John Doe",
  "picture": "https://...",
  "authenticated": true
}
```

---

## Document Ingestion

### Upload File (PDF/DOCX/Excel/CSV)
```http
POST /ingest/pdf
Content-Type: multipart/form-data
```

**Form Data:**
- `file`: File to upload (`.pdf`, `.docx`, `.xlsx`, `.xls`, `.csv`)

**Headers:**
- `Authorization: Bearer <token>` (optional)
- `X-User-ID: <user_id>` (optional)

**Response:**
```json
{
  "message": "Successfully ingested: document.pdf",
  "source_id": "uuid-here",
  "chunks_created": 42
}
```

### Ingest GitHub Repository
```http
POST /ingest/github
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://github.com/user/repo",
  "branch": "main"
}
```

**Response:**
```json
{
  "message": "Successfully ingested repository",
  "source_id": "uuid-here",
  "chunks_created": 156
}
```

### Ingest Web URL
```http
POST /ingest/url
Content-Type: application/json
```

**Request Body:**
```json
{
  "url": "https://example.com/article"
}
```

**Response:**
```json
{
  "message": "Successfully ingested URL",
  "source_id": "uuid-here",
  "chunks_created": 23
}
```

### Ingest Plain Text
```http
POST /ingest/text
Content-Type: application/json
```

**Request Body:**
```json
{
  "text": "Your text content here...",
  "name": "My Notes"
}
```

**Response:**
```json
{
  "message": "Successfully ingested text",
  "source_id": "uuid-here",
  "chunks_created": 5
}
```

---

## Query & Chat

### Query (Non-Streaming)
```http
POST /query
Content-Type: application/json
```

**Request Body:**
```json
{
  "question": "What is machine learning?",
  "session_id": "session-uuid",
  "top_k": 5,
  "source_filter": null,
  "use_agentic": true,
  "use_web_search": false
}
```

**Parameters:**
- `question` (required): The user's question
- `session_id` (optional): Session ID for conversation continuity
- `top_k` (optional, default: 5): Number of chunks to retrieve
- `source_filter` (optional): Filter by specific source ID
- `use_agentic` (optional, default: true): Enable agentic features
- `use_web_search` (optional, default: false): Enable web search

**Response:**
```json
{
  "answer": "Machine learning is...",
  "citations": [
    {
      "source": "ml_textbook.pdf",
      "content": "Machine learning is a subset...",
      "line": 42,
      "page": 3
    }
  ],
  "session_id": "session-uuid"
}
```

### Query (Streaming)
```http
POST /query/stream
Content-Type: application/json
Accept: text/event-stream
```

**Request Body:** Same as non-streaming query

**Response:** Server-Sent Events (SSE)

**Event Types:**

1. **Chunk Event** (answer tokens)
```
data: {"chunk": "Machine", "session_id": "session-uuid"}
```

2. **Web Search Event**
```
data: {"web_search": [{"title": "...", "url": "...", "snippet": "..."}], "session_id": "session-uuid"}
```

3. **Done Event**
```
data: {"done": true, "citations": [...], "session_id": "session-uuid"}
```

4. **Error Event**
```
data: {"error": "Error message"}
```

---

## Source Management

### List Sources
```http
GET /sources
```

**Headers:**
- `Authorization: Bearer <token>` (optional)
- `X-User-ID: <user_id>` (optional)

**Response:**
```json
[
  {
    "id": "source-uuid",
    "name": "document.pdf",
    "type": "pdf",
    "chunks": 42,
    "created_at": "2025-01-15T10:30:00Z",
    "expires_at": "2025-01-15T11:30:00Z"
  }
]
```

### Delete Source
```http
DELETE /sources/{source_id}
```

**Response:**
```json
{
  "message": "Source source-uuid deleted successfully"
}
```

### Clear All Sources
```http
DELETE /sources
```

**Response:**
```json
{
  "message": "All your sources cleared"
}
```

### Cleanup Expired Sources
```http
POST /sources/cleanup
```

**Response:**
```json
{
  "deleted": 3,
  "message": "Cleanup complete. Deleted 3 expired source(s)."
}
```

---

## Model Settings

### Get Current Model
```http
GET /settings/model
```

**Response:**
```json
{
  "provider": "groq",
  "model": "llama-3.3-70b-versatile",
  "available_providers": ["groq", "gemini", "openai"]
}
```

### Switch Model
```http
POST /settings/model
Content-Type: application/json
```

**Request Body:**
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```

**Response:**
```json
{
  "message": "Switched to OpenAI",
  "provider": "openai",
  "model": "gpt-4o-mini",
  "available_providers": ["groq", "gemini", "openai"]
}
```

### Get Available Providers
```http
GET /settings/providers
```

**Response:**
```json
{
  "providers": {
    "groq": {
      "models": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
      "supports_function_calling": true
    },
    "openai": {
      "models": ["gpt-4o", "gpt-4o-mini", "gpt-3.5-turbo"],
      "supports_function_calling": true
    }
  }
}
```

### Test Working Providers
```http
GET /settings/providers/working
```

Tests each provider with a minimal request and returns only working ones.

**Response:**
```json
{
  "working_providers": {
    "groq": ["llama-3.3-70b-versatile", "llama-3.1-8b-instant"],
    "openai": ["gpt-4o-mini"]
  }
}
```

### Provider Diagnostics
```http
GET /settings/providers/diagnostics
```

Detailed diagnostics for all providers and models.

**Response:**
```json
{
  "tested_at": "2025-01-15T10:30:00Z",
  "timeout_sec": 8,
  "summary": {
    "providers": 3,
    "models_ok": 5,
    "models_total": 8
  },
  "providers": {
    "groq": {
      "supports_function_calling": true,
      "models": {
        "llama-3.3-70b-versatile": {
          "ok": true,
          "latency_ms": 1234
        },
        "llama-3.1-8b-instant": {
          "ok": false,
          "latency_ms": 2000,
          "error": "Rate limit exceeded"
        }
      }
    }
  }
}
```

---

## Conversations

### Get Conversation History
```http
GET /conversations/{session_id}/history
```

**Response:**
```json
{
  "session_id": "session-uuid",
  "messages": [
    {
      "role": "user",
      "content": "What is AI?"
    },
    {
      "role": "assistant",
      "content": "AI stands for..."
    }
  ],
  "message_count": 2
}
```

### Clear Conversation
```http
POST /conversations/{session_id}/clear
```

**Response:**
```json
{
  "message": "Conversation cleared"
}
```

---

## Analytics

### Get Metrics
```http
GET /analytics/metrics
```

**Response:**
```json
{
  "total_queries": 156,
  "total_tokens": 45000,
  "total_cost": 0.23,
  "average_duration_ms": 1234,
  "success_rate": 0.98,
  "by_provider": {
    "groq": {
      "queries": 100,
      "tokens": 30000
    }
  }
}
```

### Get Provider Metrics
```http
GET /analytics/providers/{provider}
```

**Response:**
```json
{
  "provider": "groq",
  "queries": 100,
  "tokens_used": 30000,
  "total_cost": 0.0,
  "average_duration_ms": 1100,
  "success_rate": 0.99
}
```

---

## Error Responses

All endpoints return errors in this format:

```json
{
  "detail": {
    "error": "Error type",
    "message": "Human-readable error message",
    "provider": "groq"
  }
}
```

**Common Status Codes:**
- `400` - Bad Request (invalid input)
- `401` - Unauthorized (invalid API key)
- `403` - Forbidden (permission denied)
- `404` - Not Found (resource doesn't exist)
- `413` - Request Too Large (token limit exceeded)
- `429` - Too Many Requests (rate limit)
- `500` - Internal Server Error
- `503` - Service Unavailable (initializing or down)

---

## Rate Limiting

Default rate limit: **60 requests per minute** per IP address.

When rate limited, you'll receive a `429` response:
```json
{
  "detail": "Rate limit exceeded: 60 per 1 minute"
}
```

---

## Authentication

Most endpoints support optional authentication via:

1. **Bearer Token** (Google OAuth)
   ```
   Authorization: Bearer <google-jwt-token>
   ```

2. **User ID Header** (for testing)
   ```
   X-User-ID: user123
   ```

If neither is provided, requests use `user_id="default"`.

---

## Examples

### cURL Examples

**Query with streaming:**
```bash
curl -N -X POST http://localhost:8000/query/stream \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What is machine learning?",
    "use_agentic": true
  }'
```

**Upload PDF:**
```bash
curl -X POST http://localhost:8000/ingest/pdf \
  -F "file=@document.pdf"
```

**Switch model:**
```bash
curl -X POST http://localhost:8000/settings/model \
  -H "Content-Type: application/json" \
  -d '{
    "provider": "groq",
    "model": "llama-3.3-70b-versatile"
  }'
```

### Python Examples

```python
import requests

# Query
response = requests.post(
    "http://localhost:8000/query",
    json={
        "question": "What is AI?",
        "use_agentic": True
    }
)
print(response.json()["answer"])

# Upload file
with open("document.pdf", "rb") as f:
    response = requests.post(
        "http://localhost:8000/ingest/pdf",
        files={"file": f}
    )
print(response.json())
```

### JavaScript Examples

```javascript
// Query with streaming
const response = await fetch('http://localhost:8000/query/stream', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    question: 'What is AI?',
    use_agentic: true
  })
});

const reader = response.body.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;
  
  const chunk = decoder.decode(value);
  const lines = chunk.split('\n');
  
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      const data = JSON.parse(line.slice(6));
      if (data.chunk) {
        console.log(data.chunk);
      }
    }
  }
}
```

---

For more details, visit the interactive documentation at http://localhost:8000/docs
