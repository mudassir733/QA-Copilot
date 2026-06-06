

from functools import lru_cache
from typing import Literal
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # ── App 
    app_name: str = "QA Co-Pilot"
    app_version: str = "1.0.0"
    debug: bool = True

    # ── LLM Providers 
    groq_api_key: str = ""
    gemini_api_key: str = ""
    mistral_api_key: str = ""

    # ── LLM Models 
    default_llm_provider: Literal["groq", "gemini", "mistral"] = "groq"
    groq_model: str = "llama-3.3-70b-versatile"
    gemini_model: str = "gemini-2.0-flash"
    mistral_model: str = "mistral-small-latest"

    # ── Embedding
    embedding_provider: Literal["gemini", "huggingface"] = "gemini"
    gemini_embedding_model: str = "models/text-embedding-004"

    # ── ChromaDB 
    chroma_persist_dir: str = "./chroma_db"
    chroma_collection_name: str = "qa_copilot"

    # ── RAG / Chunking 
    chunk_size: int = 500          # tokens per chunk
    chunk_overlap: int = 50        # overlap between chunks to preserve context
    retriever_top_k: int = 4       # how many chunks to retrieve per question

    # ── File Upload 
    upload_dir: str = "./uploads"
    max_upload_size_mb: int = 50

    # Pydantic-settings: load from .env file automatically
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",          # ignore unknown keys in .env
    )

    # ── Computed helpers 
    @property
    def max_upload_size_bytes(self) -> int:
        return self.max_upload_size_mb * 1024 * 1024

    def get_active_llm_model(self, provider: str | None = None) -> str:
        """Return the model name for the given (or default) provider."""
        p = provider or self.default_llm_provider
        return {
            "groq": self.groq_model,
            "gemini": self.gemini_model,
            "mistral": self.mistral_model,
        }[p]

    def get_api_key(self, provider: str | None = None) -> str:
        """Return the API key for the given (or default) provider."""
        p = provider or self.default_llm_provider
        return {
            "groq": self.groq_api_key,
            "gemini": self.gemini_api_key,
            "mistral": self.mistral_api_key,
        }[p]


@lru_cache          # instantiated once, reused everywhere
def get_settings() -> Settings:
    return Settings()


# Module-level singleton — `from app.core.config import settings`
settings = get_settings()