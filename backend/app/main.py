from fastapi import FastAPI, HTTPException, UploadFile, File, BackgroundTasks, Header, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from contextlib import asynccontextmanager
import uuid
import asyncio
import json
import os
from datetime import datetime
import traceback
import time

from app.config import get_settings
from app.auth import get_user_id, get_current_user, GOOGLE_CLIENT_ID
from app.middleware.logging import RequestLoggingMiddleware
from app.middleware.security import SecurityMiddleware
from app.middleware.rate_limit import limiter

# Initialize Sentry if DSN is provided
settings = get_settings()
if settings.sentry_dsn:
    import sentry_sdk
    from sentry_sdk.integrations.fastapi import FastApiIntegration
    from sentry_sdk.integrations.asyncio import AsyncioIntegration
    
    sentry_sdk.init(
        dsn=settings.sentry_dsn,
        integrations=[
            FastApiIntegration(),
            AsyncioIntegration(),
        ],
        traces_sample_rate=1.0 if settings.environment == "production" else 0.1,
        environment=settings.environment,
    )

# Global instances (initialized on startup)
vector_store = None
agentic_engine = None
cleanup_task = None
initialization_status = "startup"  # startup, initializing, ready, failed
initialization_error = None

async def initialize_rag_engine():
    """Initialize RAG engine in background to avoid blocking startup."""
    global vector_store, agentic_engine, initialization_status, initialization_error
    
    # Add a small delay to ensure server starts first
    await asyncio.sleep(2)
    
    try:
        initialization_status = "initializing"
        print("Starting background initialization of RAG engine...")
        
        # Heavy imports moved here to avoid blocking import time
        from app.rag.vectorstore import VectorStore
        from app.rag.agent.agentic_engine import AgenticRAGEngine
        
        # Initialize VectorStore (makes API calls)
        vector_store = VectorStore()
        print("Successfully connected to Qdrant Cloud!")
        
        
        # Initialize Agentic Engine (loads models)
        agentic_engine = AgenticRAGEngine(vector_store)
        print("Agentic RAG Engine initialized!")
        
        # Run initial cleanup
        deleted = vector_store.cleanup_expired_sources()
        if deleted > 0:
            print(f"Initial cleanup: Deleted {deleted} expired source(s)")
            
        initialization_status = "ready"
        print("RAG Engine initialization complete!")
        
    except Exception as e:
        initialization_status = "failed"
        initialization_error = str(e)
        print(f"Warning: Could not initialize RAG engine: {e}")
        traceback.print_exc()

async def periodic_cleanup():
    """Background task to cleanup expired sources every 10 minutes."""
    while True:
        try:
            await asyncio.sleep(600)  # Wait 10 minutes
            if vector_store:
                deleted = vector_store.cleanup_expired_sources()
                if deleted > 0:
                    print(f"[{datetime.utcnow().isoformat()}] Auto-cleanup: Deleted {deleted} expired source(s)")
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Error in periodic cleanup: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Initialize components on startup."""
    global cleanup_task

    # Print immediately to show startup is progressing
    print("FastAPI lifespan starting...")
    
    # Start initialization in background - don't await it
    asyncio.create_task(initialize_rag_engine())
    
    # Start background cleanup task
    cleanup_task = asyncio.create_task(periodic_cleanup())
    print("Started periodic cleanup task (runs every 10 minutes)")
    
    print("FastAPI startup complete - server ready to accept connections")

    # Yield immediately to allow server to start accepting connections
    yield

    # Cleanup on shutdown
    print("Shutting down...")
    if cleanup_task:
        cleanup_task.cancel()
        try:
            await cleanup_task
        except asyncio.CancelledError:
            pass


app = FastAPI(
    title="RAG Study Assistant API",
    description="Ingest GitHub repos, PDFs, and web content. Ask questions with cited answers. Data auto-deletes after 1 hour.",
    version="2.0.0",
    lifespan=lifespan
)

# Add middleware (order matters - logging first, then security)
app.add_middleware(RequestLoggingMiddleware)
app.add_middleware(SecurityMiddleware)

# CORS - Allow all origins (required for Vercel/Render deployment)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all origins
    allow_credentials=False,  # Must be False when using "*"
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add rate limiting
app.state.limiter = limiter


# ========================
# Request/Response Models
# ========================

class GitHubIngestRequest(BaseModel):
    url: str
    branch: Optional[str] = "main"

class URLIngestRequest(BaseModel):
    url: str


class TextIngestRequest(BaseModel):
    text: str
    name: Optional[str] = None


class QueryRequest(BaseModel):
    question: str
    session_id: Optional[str] = None
    top_k: int = 5
    source_filter: Optional[str] = None
    use_agentic: bool = True
    use_web_search: bool = False

class Citation(BaseModel):
    source: str
    content: str
    line: Optional[int] = None
    page: Optional[int] = None

class QueryResponse(BaseModel):
    answer: str
    citations: list[Citation]
    session_id: str

class SourceInfo(BaseModel):
    id: str
    name: str
    type: str
    chunks: int
    created_at: Optional[str] = None
    expires_at: Optional[str] = None

class IngestResponse(BaseModel):
    message: str
    source_id: str
    chunks_created: int

class CleanupResponse(BaseModel):
    deleted: int
    message: str


# ========================
# Health Check
# ========================

@app.get("/")
async def root():
    """Root endpoint for basic connectivity check."""
    return {
        "message": "RAG Study Assistant API is running",
        "status": "online",
        "version": "2.0.0",
        "docs_url": "/docs"
    }

@app.get("/health")
async def health_check():
    if initialization_status == "initializing":
        raise HTTPException(
            status_code=503,
            detail={"status": "initializing", "message": "RAG engine is starting up..."}
        )
    if initialization_status == "failed":
        raise HTTPException(
            status_code=503,
            detail={"status": "unhealthy", "error": initialization_error}
        )

    return {
        "status": "healthy",
        "init_status": initialization_status,
        "version": "2.0.0",
        "vector_store": "connected" if vector_store else "not connected",
        "data_retention_hours": 1
    }


# ========================
# Auth Endpoints
# ========================

@app.get("/auth/config")
async def get_auth_config():
    """Get auth configuration for frontend."""
    return {
        "google_client_id": GOOGLE_CLIENT_ID,
        "auth_enabled": bool(GOOGLE_CLIENT_ID)
    }


@app.get("/auth/me")
async def get_me(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Get current user info."""
    user = get_current_user(authorization)
    return {
        "user_id": user.get("user_id", x_user_id or "anonymous"),
        "email": user.get("email", ""),
        "name": user.get("name", "Guest"),
        "picture": user.get("picture", ""),
        "authenticated": bool(authorization and GOOGLE_CLIENT_ID)
    }


# ========================
# Ingest Endpoints
# ========================

@app.post("/ingest/github", response_model=IngestResponse)
async def ingest_github(
    request: GitHubIngestRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Ingest a public GitHub repository."""
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")

    user_id = get_user_id(authorization, x_user_id)

    try:
        from app.ingest.github import ingest_github_repo
        source_id, chunks = await ingest_github_repo(
            url=request.url,
            branch=request.branch,
            vector_store=vector_store,
            user_id=user_id
        )
        return IngestResponse(
            message=f"Successfully ingested repository",
            source_id=source_id,
            chunks_created=chunks
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ingest/pdf", response_model=IngestResponse)
async def ingest_pdf_file(
    file: UploadFile = File(...),
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Upload and ingest a PDF, Excel, CSV, or DOCX file."""
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")

    allowed_extensions = (".pdf", ".xlsx", ".xls", ".csv", ".docx")
    file_ext = os.path.splitext(file.filename)[1].lower() if file.filename else ""
    if file_ext not in allowed_extensions:
        raise HTTPException(status_code=400, detail=f"File must be one of: {', '.join(allowed_extensions)}")

    user_id = get_user_id(authorization, x_user_id)

    try:
        content = await file.read()

        if file_ext == ".pdf":
            from app.ingest.pdf import ingest_pdf
            source_id, chunks = await ingest_pdf(
                content=content,
                filename=file.filename,
                vector_store=vector_store,
                user_id=user_id
            )
        elif file_ext == ".docx":
            from app.ingest.docx import ingest_docx
            source_id, chunks = await ingest_docx(
                content=content,
                filename=file.filename,
                vector_store=vector_store,
                user_id=user_id
            )
        else:
            from app.ingest.excel import ingest_excel
            source_id, chunks = await ingest_excel(
                content=content,
                filename=file.filename,
                vector_store=vector_store,
                user_id=user_id
            )

        return IngestResponse(
            message=f"Successfully ingested: {file.filename}",
            source_id=source_id,
            chunks_created=chunks
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ingest/url", response_model=IngestResponse)
async def ingest_web_url(
    request: URLIngestRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Scrape and ingest content from a web URL."""
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")

    user_id = get_user_id(authorization, x_user_id)

    try:
        from app.ingest.web import ingest_url
        source_id, chunks = await ingest_url(
            url=request.url,
            vector_store=vector_store,
            user_id=user_id
        )
        return IngestResponse(
            message=f"Successfully ingested URL",
            source_id=source_id,
            chunks_created=chunks
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/ingest/text", response_model=IngestResponse)
async def ingest_text_source(
    request: TextIngestRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Ingest raw text as a source."""
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")

    user_id = get_user_id(authorization, x_user_id)

    try:
        from app.ingest.text import ingest_text
        source_id, chunks = await ingest_text(
            text=request.text,
            vector_store=vector_store,
            user_id=user_id,
            name=request.name,
        )
        return IngestResponse(
            message="Successfully ingested text",
            source_id=source_id,
            chunks_created=chunks,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Query Endpoint
# ========================

@app.post("/query", response_model=QueryResponse)
@limiter.limit("60/minute")
async def query(
    request: Request,
    query_request: QueryRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Ask a question and get an answer with citations."""
    if not agentic_engine:
        raise HTTPException(status_code=503, detail="Query engine not initialized")

    session_id = query_request.session_id or str(uuid.uuid4())
    user_id = get_user_id(authorization, x_user_id)

    try:
        result = await agentic_engine.query(
            question=query_request.question,
            session_id=session_id,
            top_k=query_request.top_k,
            source_filter=query_request.source_filter,
            user_id=user_id,
            use_agentic=query_request.use_agentic,
            use_web_search=query_request.use_web_search
        )
        
        # Ensure result is properly unpacked
        if isinstance(result, tuple) and len(result) >= 2:
            answer, citations, metadata = result[0], result[1], result[2] if len(result) > 2 else {}
        else:
            # Fallback if result format is unexpected
            answer = str(result[0]) if isinstance(result, tuple) and len(result) > 0 else str(result)
            citations = result[1] if isinstance(result, tuple) and len(result) > 1 else []
            metadata = result[2] if isinstance(result, tuple) and len(result) > 2 else {}
        
        # Ensure answer is a string
        if not isinstance(answer, str):
            if isinstance(answer, tuple):
                # If answer is a tuple, take the first element
                answer = str(answer[0]) if len(answer) > 0 else ""
            else:
                answer = str(answer)
        
        return QueryResponse(
            answer=answer,
            citations=[Citation(**c) for c in citations],
            session_id=session_id
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ========================
# Source Management
# ========================

@app.get("/sources", response_model=list[SourceInfo])
async def list_sources(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """List all ingested sources for the current user."""
    if not vector_store:
        return []

    user_id = get_user_id(authorization, x_user_id)
    sources = vector_store.list_sources(user_id)
    return [SourceInfo(**s) for s in sources]


@app.delete("/sources/{source_id}")
async def delete_source(
    source_id: str,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Delete a source and its chunks (only if owned by user)."""
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")

    user_id = get_user_id(authorization, x_user_id)

    try:
        vector_store.delete_source(source_id, user_id)
        return {"message": f"Source {source_id} deleted successfully"}
    except Exception as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.delete("/sources")
async def clear_all_sources(
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Delete all sources for the current user."""
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")

    user_id = get_user_id(authorization, x_user_id)
    # Get user's sources and delete them one by one
    sources = vector_store.list_sources(user_id)
    for source in sources:
        vector_store.delete_source(source["id"], user_id)
    return {"message": "All your sources cleared"}


@app.post("/sources/cleanup", response_model=CleanupResponse)
async def cleanup_expired():
    """Manually trigger cleanup of expired sources."""
    if not vector_store:
        raise HTTPException(status_code=503, detail="Vector store not initialized")

    deleted = vector_store.cleanup_expired_sources()
    return CleanupResponse(
        deleted=deleted,
        message=f"Cleanup complete. Deleted {deleted} expired source(s)."
    )


# ========================
# Model Settings
# ========================

class ModelConfig(BaseModel):
    provider: str
    model: Optional[str] = None

@app.get("/settings/model")
async def get_model_settings():
    """Get current LLM model configuration."""
    if not agentic_engine:
        raise HTTPException(status_code=503, detail="Query engine not initialized")

    return agentic_engine.get_current_config()


@app.post("/settings/model")
async def set_model_settings(config: ModelConfig):
    """Switch LLM provider/model."""
    if not agentic_engine:
        raise HTTPException(status_code=503, detail="Query engine not initialized")

    try:
        agentic_engine.set_provider(config.provider, config.model)
        return {
            "message": f"Switched to {config.provider}",
            **agentic_engine.get_current_config()
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.get("/settings/providers")
async def get_available_providers():
    """Get list of available providers and their models."""
    from app.rag.providers.factory import ProviderFactory
    factory = ProviderFactory()
    
    providers_info = {}
    for provider_name in factory.get_available_providers():
        provider = factory.create_provider(provider_name)
        if provider:
            providers_info[provider_name] = {
                "models": provider.get_available_models(),
                "supports_function_calling": provider.supports_function_calling()
            }
    
    return {"providers": providers_info}


@app.get("/settings/providers/working")
async def get_working_providers():
    """Test each configured provider with a minimal generate; return only working provider/models."""
    from app.rag.providers.factory import ProviderFactory
    from app.rag.providers.base import LLMMessage
    import asyncio

    factory = ProviderFactory()
    working = {}
    test_message = [LLMMessage(role="user", content="Say OK")]
    timeout_sec = 8

    for provider_name in factory.get_available_providers():
        provider = factory.create_provider(provider_name)
        if not provider:
            continue
        try:
            await asyncio.wait_for(
                provider.generate(messages=test_message, max_tokens=10),
                timeout=timeout_sec,
            )
            working[provider_name] = provider.get_available_models()
        except (asyncio.TimeoutError, Exception):
            continue

    return {"working_providers": working}


@app.get("/settings/providers/diagnostics")
async def get_provider_diagnostics():
    """Test each configured provider+model and return per-model status (ok/error/latency)."""
    from app.rag.providers.factory import ProviderFactory
    from app.rag.providers.base import LLMMessage
    import asyncio

    factory = ProviderFactory()
    timeout_sec = 8
    test_message = [LLMMessage(role="user", content="Say OK")]

    providers: dict[str, dict] = {}

    for provider_name in factory.get_available_providers():
        base_provider = factory.create_provider(provider_name)
        if not base_provider:
            continue

        models = base_provider.get_available_models()
        supports_function_calling = base_provider.supports_function_calling()
        model_results: dict[str, dict] = {}

        for model_id in models:
            provider = factory.create_provider(provider_name, model=model_id)
            if not provider:
                continue

            started = time.perf_counter()
            try:
                await asyncio.wait_for(
                    provider.generate(messages=test_message, max_tokens=10),
                    timeout=timeout_sec,
                )
                latency_ms = int((time.perf_counter() - started) * 1000)
                model_results[model_id] = {"ok": True, "latency_ms": latency_ms}
            except Exception as e:
                latency_ms = int((time.perf_counter() - started) * 1000)
                err = str(e) or e.__class__.__name__
                if len(err) > 500:
                    err = err[:500] + "..."
                model_results[model_id] = {"ok": False, "latency_ms": latency_ms, "error": err}

        providers[provider_name] = {
            "supports_function_calling": supports_function_calling,
            "models": model_results,
        }

    total_models = sum(len(p.get("models", {})) for p in providers.values())
    ok_models = sum(
        1 for p in providers.values() for r in p.get("models", {}).values() if r.get("ok") is True
    )

    return {
        "tested_at": datetime.utcnow().isoformat() + "Z",
        "timeout_sec": timeout_sec,
        "summary": {"providers": len(providers), "models_ok": ok_models, "models_total": total_models},
        "providers": providers,
    }


@app.post("/conversations/{session_id}/clear")
async def clear_conversation(session_id: str):
    """Clear conversation history for a session."""
    if not agentic_engine:
        raise HTTPException(status_code=503, detail="Query engine not initialized")
    
    agentic_engine.clear_conversation(session_id)
    return {"message": "Conversation cleared"}


@app.get("/conversations/{session_id}/history")
async def get_conversation_history(session_id: str):
    """Get conversation history for a session."""
    if not agentic_engine:
        raise HTTPException(status_code=503, detail="Query engine not initialized")
    
    history = agentic_engine.conversations.get(session_id, [])
    return {
        "session_id": session_id,
        "messages": history,
        "message_count": len(history)
    }


@app.get("/analytics/metrics")
async def get_metrics():
    """Get usage metrics."""
    from app.analytics.metrics import metrics_collector
    return metrics_collector.get_total_stats()


@app.get("/analytics/providers/{provider}")
async def get_provider_metrics(provider: str):
    """Get metrics for a specific provider."""
    from app.analytics.metrics import metrics_collector
    return metrics_collector.get_provider_stats(provider)


@app.post("/query/stream")
@limiter.limit("60/minute")
async def query_stream(
    request: Request,
    query_request: QueryRequest,
    authorization: Optional[str] = Header(None),
    x_user_id: Optional[str] = Header(None)
):
    """Stream query responses token-by-token."""
    if not agentic_engine:
        raise HTTPException(status_code=503, detail="Query engine not initialized")

    session_id = query_request.session_id or str(uuid.uuid4())
    user_id = get_user_id(authorization, x_user_id)

    async def generate_stream():
        try:
            async for event in agentic_engine.query_stream(
                question=query_request.question,
                session_id=session_id,
                top_k=query_request.top_k,
                source_filter=query_request.source_filter,
                user_id=user_id,
                use_agentic=query_request.use_agentic,
                use_web_search=query_request.use_web_search
            ):
                if event.get("type") == "chunk":
                    yield f"data: {json.dumps({'chunk': event.get('content'), 'session_id': event.get('session_id')})}\n\n"
                elif event.get("type") == "web_search":
                    yield f"data: {json.dumps({'web_search': event.get('results'), 'session_id': session_id})}\n\n"
                elif event.get("type") == "done":
                    yield f"data: {json.dumps({'done': True, 'citations': event.get('citations'), 'session_id': event.get('session_id')})}\n\n"
                elif event.get("type") == "error":
                    yield f"data: {json.dumps({'error': event.get('error')})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")
