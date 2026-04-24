# Neuron - AI Study Assistant 🧠

A production-ready, agentic RAG (Retrieval Augmented Generation) system with multi-model support, web search, and a beautiful streaming chat interface. Upload documents, ask questions, and get AI-powered answers with citations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-blue.svg)
![Node](https://img.shields.io/badge/node-18+-green.svg)

## ✨ Features

### 🤖 Multi-Model AI Support
- **OpenAI** - GPT-4o, GPT-4o-mini, GPT-4-turbo, GPT-3.5-turbo
- **Anthropic Claude** - Claude Sonnet 4
- **Google Gemini** - Gemini 1.5/2.0 Flash, Gemini Pro
- **Groq** - LLaMA 3.3 70B, LLaMA 3.1 (ultra-fast inference)

### 🎯 Agentic Capabilities
- **Smart Query Planning** - Automatic query decomposition and execution planning
- **Multi-Hop Retrieval** - Iterative retrieval with query expansion and re-ranking
- **Tool Integration** - Web search (Tavily/Google), code execution, calculator
- **Self-Reflection** - Answer verification and quality assessment
- **Conversation Memory** - Context-aware responses with chat history

### 📚 Document Ingestion
- **PDF** - Extract text and tables from PDF documents
- **Word Documents** - Full .docx support with table extraction
- **Excel/CSV** - Spreadsheet data ingestion
- **GitHub Repositories** - Clone and index entire codebases
- **Web Pages** - Scrape and index web content
- **Plain Text** - Direct text input

### 💬 Modern Chat Interface
- **Streaming Responses** - Token-by-token real-time output
- **Multi-Session Management** - Create, rename, and switch between chats
- **Export Conversations** - Download as JSON, Markdown, or PDF
- **Drag & Drop Upload** - Intuitive file upload experience
- **Keyboard Shortcuts** - Power user productivity features
- **Dark/Light Theme** - Beautiful UI with theme switching
- **Citation Display** - See sources for every answer
- **Web Search Results** - Visual display of search results

### 🔒 Production Ready
- **Rate Limiting** - Protect your API from abuse
- **Structured Logging** - Request IDs and detailed logs
- **Security Middleware** - CORS, headers, input validation
- **Error Handling** - Graceful degradation and retry logic
- **Local Embeddings Fallback** - Works without API quotas
- **Auto Data Cleanup** - Privacy-focused 1-hour retention

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- [Qdrant Cloud](https://cloud.qdrant.io) account (free tier)
- At least one LLM API key (Groq recommended for free tier)

### Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env and add your API keys

# Start server
uvicorn app.main:app --reload --port 8000
```

**Verify backend:**
- Health check: http://localhost:8000/health
- API docs: http://localhost:8000/docs

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# NEXT_PUBLIC_API_URL should be http://localhost:8000

# Start development server
npm run dev
```

**Open app:** http://localhost:3000

## 🔑 Getting API Keys

### Required (Free Tier Available)

1. **Qdrant** (Vector Database)
   - Sign up: https://cloud.qdrant.io
   - Create a free cluster
   - Copy URL and API key to `.env`

2. **Groq** (Recommended - Fast & Free)
   - Sign up: https://console.groq.com
   - Create API key
   - Add to `.env`: `GROQ_API_KEY=...`

### Optional

3. **Gemini** (Google AI)
   - Get key: https://aistudio.google.com/apikey
   - Free tier: 1,500 requests/day

4. **OpenAI**
   - Get key: https://platform.openai.com/api-keys
   - Paid service

5. **Tavily** (Web Search)
   - Sign up: https://tavily.com
   - Free tier: 1,000 searches/month

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Focus input box |
| `Ctrl/Cmd + Enter` | Send message |
| `Ctrl/Cmd + N` | New chat session |
| `Ctrl/Cmd + E` | Export chat |
| `Ctrl/Cmd + F` | Search messages |
| `Esc` | Close dialogs/panels |

## 📖 API Documentation

### Core Endpoints

**Query**
- `POST /query` - Get AI response with citations
- `POST /query/stream` - Stream response (SSE)
- `GET /conversations/{session_id}/history` - Get chat history

**Document Ingestion**
- `POST /ingest/pdf` - Upload PDF/DOCX/Excel/CSV
- `POST /ingest/github` - Index GitHub repository
- `POST /ingest/url` - Scrape web page
- `POST /ingest/text` - Add plain text

**Source Management**
- `GET /sources` - List all sources
- `DELETE /sources/{source_id}` - Delete source
- `DELETE /sources` - Clear all sources

**Model Settings**
- `GET /settings/model` - Get current model
- `POST /settings/model` - Switch model/provider
- `GET /settings/providers` - List available providers
- `GET /settings/providers/working` - Test providers

**Analytics**
- `GET /analytics/metrics` - Usage statistics
- `GET /analytics/providers/{provider}` - Provider-specific metrics

Full API documentation: http://localhost:8000/docs

## 🏗️ Architecture

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────────────┐
│     Agentic RAG Engine              │
│  ┌──────────┐  ┌─────────────────┐ │
│  │ Planner  │─▶│ Query Router    │ │
│  └──────────┘  └─────────────────┘ │
│                        │            │
│                        ▼            │
│              ┌──────────────────┐  │
│              │ Multi-Hop        │  │
│              │ Retrieval        │  │
│              └──────────────────┘  │
│                        │            │
│                        ▼            │
│              ┌──────────────────┐  │
│              │ Tool Executor    │  │
│              │ (Web/Code/Calc)  │  │
│              └──────────────────┘  │
│                        │            │
│                        ▼            │
│              ┌──────────────────┐  │
│              │ LLM Provider     │  │
│              │ (Multi-model)    │  │
│              └──────────────────┘  │
│                        │            │
│                        ▼            │
│              ┌──────────────────┐  │
│              │ Verifier         │  │
│              │ (Self-reflect)   │  │
│              └──────────────────┘  │
└─────────────────────────────────────┘
                       │
                       ▼
              ┌────────────────┐
              │ Final Response │
              │ + Citations    │
              └────────────────┘
```

## 🛠️ Tech Stack

**Backend**
- FastAPI - Modern Python web framework
- Qdrant - Vector database
- sentence-transformers - Local embeddings
- LangChain components - RAG utilities
- httpx - Async HTTP client

**Frontend**
- Next.js 14 - React framework
- TypeScript - Type safety
- Tailwind CSS - Styling
- React Hot Toast - Notifications
- Lucide Icons - Icon library

## 📁 Project Structure

```
.
├── backend/
│   ├── app/
│   │   ├── analytics/      # Usage metrics
│   │   ├── ingest/         # Document processors
│   │   ├── middleware/     # Security, logging, rate limiting
│   │   ├── rag/
│   │   │   ├── agent/      # Agentic components
│   │   │   ├── providers/  # LLM integrations
│   │   │   ├── retrieval/  # Multi-hop, reranking
│   │   │   └── tools/      # Web search, calculator, etc.
│   │   ├── utils/          # Helpers
│   │   ├── auth.py         # Authentication
│   │   ├── config.py       # Settings
│   │   └── main.py         # FastAPI app
│   └── requirements.txt
│
├── frontend/
│   ├── src/
│   │   ├── app/            # Next.js pages
│   │   ├── components/     # React components
│   │   └── lib/            # Utilities, API client
│   ├── package.json
│   └── tailwind.config.js
│
├── .github/                # GitHub workflows
├── API.md                  # API documentation
├── DEPLOYMENT.md           # Deployment guide
├── ENV_VARS.md             # Environment variables
└── README.md               # This file
```

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- Built with FastAPI, Next.js, and Qdrant
- Powered by OpenAI, Anthropic, Google, and Groq
- Inspired by modern RAG architectures

## 📧 Support

For issues and questions, please open an issue on GitHub.

---

**Made with ❤️ for students and researchers**
