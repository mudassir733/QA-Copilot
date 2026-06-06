"""
app/services/embeddings.py

Embedding service — converts text into vectors.

Two providers supported:
  • gemini      → Google text-embedding-004  (free, high quality, requires API key)
  • huggingface → all-MiniLM-L6-v2          (free, runs locally, no API key needed)

The same provider MUST be used at ingest time and query time,
because vectors must live in the same space to be comparable.

Usage:
    from app.services.embeddings import embedding_service
    embeddings = embedding_service.get_embeddings()
"""

from langchain_core.embeddings import Embeddings

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ── Per-provider builders 

def _build_gemini_embeddings() -> Embeddings:
    from langchain_google_genai import GoogleGenerativeAIEmbeddings

    if not settings.gemini_api_key:
        raise ValueError(
            "GEMINI_API_KEY is not set in .env — "
            "required for embedding_provider=gemini"
        )

    logger.info(
        "Building Gemini embeddings | model=%s",
        settings.gemini_embedding_model,
    )
    return GoogleGenerativeAIEmbeddings(
        google_api_key=settings.gemini_api_key,
        model=settings.gemini_embedding_model,
        # task_type tells Gemini what these embeddings are for,
        # which improves retrieval accuracy
        task_type="retrieval_document",
    )


def _build_huggingface_embeddings() -> Embeddings:
    from langchain_community.embeddings import HuggingFaceEmbeddings

    model_name = "sentence-transformers/all-MiniLM-L6-v2"
    logger.info("Building HuggingFace embeddings | model=%s", model_name)

    # Runs 100% locally — downloads model on first call (~80 MB)
    return HuggingFaceEmbeddings(
        model_name=model_name,
        model_kwargs={"device": "cpu"},
        encode_kwargs={"normalize_embeddings": True},  # cosine similarity ready
    )


_BUILDERS = {
    "gemini":      _build_gemini_embeddings,
    "huggingface": _build_huggingface_embeddings,
}


# ── Embedding service 

class EmbeddingService:
    """
    Lazily builds and caches one embedding model instance.
    Provider is determined by settings.embedding_provider.
    """

    def __init__(self) -> None:
        self._instance: Embeddings | None = None

    def get_embeddings(self) -> Embeddings:
        """Return the cached embedding model, building it on first call."""
        if self._instance is None:
            provider = settings.embedding_provider

            if provider not in _BUILDERS:
                raise ValueError(
                    f"Unknown embedding provider '{provider}'. "
                    f"Valid options: {list(_BUILDERS.keys())}"
                )

            self._instance = _BUILDERS[provider]()
            logger.info(
                "Embedding model ready | provider=%s", provider
            )

        return self._instance

    def embed_query(self, text: str) -> list[float]:
        """
        Embed a single query string into a vector.
        Use this at question-answering time.
        """
        return self.get_embeddings().embed_query(text)

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        """
        Embed a list of document chunks into vectors.
        Use this at ingestion time.
        """
        logger.debug("Embedding %d document chunks", len(texts))
        return self.get_embeddings().embed_documents(texts)

    def reset(self) -> None:
        """Force a rebuild on the next call (useful in tests)."""
        self._instance = None


# ── Module-level singleton 
embedding_service = EmbeddingService()