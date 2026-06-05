


from functools import lru_cache
from langchain_core.language_models.chat_models import BaseChatModel

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


# ── Per-provider builder functions 

def _build_groq() -> BaseChatModel:
    from langchain_groq import ChatGroq

    if not settings.groq_api_key:
        raise ValueError("GROQ_API_KEY is not set in .env")

    logger.info("Building Groq LLM | model=%s", settings.groq_model)
    return ChatGroq(
        api_key=settings.groq_api_key,
        model=settings.groq_model,
        temperature=0.2,        # low temp = factual, deterministic answers
        max_tokens=2048,
    )


def _build_gemini() -> BaseChatModel:
    from langchain_google_genai import ChatGoogleGenerativeAI

    if not settings.gemini_api_key:
        raise ValueError("GEMINI_API_KEY is not set in .env")

    logger.info("Building Gemini LLM | model=%s", settings.gemini_model)
    return ChatGoogleGenerativeAI(
        google_api_key=settings.gemini_api_key,
        model=settings.gemini_model,
        temperature=0.2,
        max_output_tokens=2048,
    )


def _build_mistral() -> BaseChatModel:
    from langchain_mistralai import ChatMistralAI

    if not settings.mistral_api_key:
        raise ValueError("MISTRAL_API_KEY is not set in .env")

    logger.info("Building Mistral LLM | model=%s", settings.mistral_model)
    return ChatMistralAI(
        api_key=settings.mistral_api_key,
        model=settings.mistral_model,
        temperature=0.2,
        max_tokens=2048,
    )


# ── Builder registry 

_BUILDERS = {
    "groq":    _build_groq,
    "gemini":  _build_gemini,
    "mistral": _build_mistral,
}


# ── Router class 

class LLMRouter:
    """
    Lazily builds and caches one LLM instance per provider.
    Call get_llm() to retrieve a LangChain chat model ready for use.
    """

    def __init__(self) -> None:
        self._cache: dict[str, BaseChatModel] = {}

    def get_llm(self, provider: str | None = None) -> BaseChatModel:
        """
        Return a cached LangChain LLM for the given provider.
        Falls back to settings.default_llm_provider when provider is None.
        """
        provider = (provider or settings.default_llm_provider).lower()

        if provider not in _BUILDERS:
            raise ValueError(
                f"Unknown provider '{provider}'. "
                f"Valid options: {list(_BUILDERS.keys())}"
            )

        # Build once, reuse forever (within a process lifetime)
        if provider not in self._cache:
            self._cache[provider] = _BUILDERS[provider]()
            logger.debug("LLM instance cached for provider=%s", provider)

        return self._cache[provider]

    def available_providers(self) -> list[str]:
        """Return the list of configured (non-empty key) providers."""
        configured = []
        if settings.groq_api_key:
            configured.append("groq")
        if settings.gemini_api_key:
            configured.append("gemini")
        if settings.mistral_api_key:
            configured.append("mistral")
        return configured

    def clear_cache(self) -> None:
        """Force rebuild of all LLM instances (useful in tests)."""
        self._cache.clear()


# ── Module-level singleton 
llm_router = LLMRouter()