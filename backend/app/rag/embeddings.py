from google import genai
from google.genai import types
from app.config import get_settings

settings = get_settings()

client = genai.Client(api_key=settings.gemini_api_key) if settings.gemini_api_key else None


class GeminiEmbeddings:
    """
    Wrapper for embeddings. Tries Gemini models first; falls back to a local
    sentence-transformers model (all-MiniLM-L6-v2, 384 dims) when Gemini quota
    is exhausted or unavailable.
    """

    # Gemini embedding models to try in order
    GEMINI_MODELS = [
        "gemini-embedding-001",  # Latest model (3072 dims)
        "text-embedding-004",    # Fallback
    ]
    VECTOR_SIZE = 3072  # updated dynamically based on the model actually used

    def __init__(self):
        self.model = self.GEMINI_MODELS[0]
        self._use_local = False
        self._local_model = None

        if client:
            self._test_model()
        else:
            self._init_local_fallback()

    def _test_model(self):
        """Test which embedding model is available."""
        for model in self.GEMINI_MODELS:
            try:
                response = client.models.embed_content(
                    model=model,
                    contents="test"
                )
                self.model = model
                if response.embeddings and response.embeddings[0].values:
                    GeminiEmbeddings.VECTOR_SIZE = len(response.embeddings[0].values)
                print(f"Using embedding model: {model} (dim={GeminiEmbeddings.VECTOR_SIZE})")
                return
            except Exception as e:
                print(f"Model {model} not available: {e}")
                continue

        print("Warning: Gemini embedding quota exhausted — falling back to local model.")
        self._init_local_fallback()

    def _init_local_fallback(self):
        """Load a local sentence-transformers model as fallback."""
        # Skip local model in production to reduce memory/startup time
        import os
        if os.getenv("ENVIRONMENT") == "production":
            print("Production mode: Skipping local embedding model (use API-based embeddings)")
            self._use_local = False
            self._local_model = None
            return
            
        try:
            from sentence_transformers import SentenceTransformer
            self._local_model = SentenceTransformer("all-MiniLM-L6-v2")
            self._use_local = True
            GeminiEmbeddings.VECTOR_SIZE = 384
            print("Using local embedding model: all-MiniLM-L6-v2 (dim=384)")
        except ImportError:
            print(
                "Warning: sentence-transformers not installed. "
                "Run: pip install sentence-transformers\n"
                "Embeddings will return zero vectors until a model is available."
            )

    def _local_embed(self, text: str) -> list[float]:
        if self._local_model is None:
            return [0.0] * self.VECTOR_SIZE
        return self._local_model.encode(text, normalize_embeddings=True).tolist()

    def embed_text(self, text: str) -> list[float]:
        """Generate embedding for a single text."""
        if self._use_local:
            return self._local_embed(text)
        if not client:
            return [0.0] * self.VECTOR_SIZE
        try:
            response = client.models.embed_content(
                model=self.model,
                contents=text,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
            )
            return response.embeddings[0].values
        except Exception as e:
            print(f"Error embedding text: {e}")
            return [0.0] * self.VECTOR_SIZE

    def embed_query(self, query: str) -> list[float]:
        """Generate embedding for a query."""
        if self._use_local:
            return self._local_embed(query)
        if not client:
            return [0.0] * self.VECTOR_SIZE
        try:
            response = client.models.embed_content(
                model=self.model,
                contents=query,
                config=types.EmbedContentConfig(task_type="RETRIEVAL_QUERY")
            )
            return response.embeddings[0].values
        except Exception as e:
            print(f"Error embedding query: {e}")
            return [0.0] * self.VECTOR_SIZE

    def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """Generate embeddings for multiple texts."""
        if self._use_local:
            if self._local_model is None:
                return [[0.0] * self.VECTOR_SIZE] * len(texts)
            return self._local_model.encode(
                texts, normalize_embeddings=True, show_progress_bar=False
            ).tolist()

        all_embeddings = []
        batch_size = 20
        for i in range(0, len(texts), batch_size):
            batch = texts[i:i + batch_size]
            for text in batch:
                if not client:
                    all_embeddings.append([0.0] * self.VECTOR_SIZE)
                else:
                    try:
                        response = client.models.embed_content(
                            model=self.model,
                            contents=text,
                            config=types.EmbedContentConfig(task_type="RETRIEVAL_DOCUMENT")
                        )
                        all_embeddings.append(response.embeddings[0].values)
                    except Exception as e:
                        print(f"Error embedding text: {e}")
                        all_embeddings.append([0.0] * self.VECTOR_SIZE)

        return all_embeddings
