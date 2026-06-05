"""
app/api/health.py

Health-check endpoints.
GET /health          — basic liveness probe
GET /health/llm      — checks which LLM providers are configured
"""

from fastapi import APIRouter
from pydantic import BaseModel

from app.core.config import settings
from app.services.llm_service import llm_router

router = APIRouter(prefix="/health", tags=["Health"])


class HealthResponse(BaseModel):
    status: str
    app_name: str
    version: str
    debug: bool


class LLMHealthResponse(BaseModel):
    default_provider: str
    configured_providers: list[str]
    active_models: dict[str, str]


@router.get("", response_model=HealthResponse)
async def health_check():
    """Basic liveness probe — returns 200 when the server is running."""
    return HealthResponse(
        status="ok",
        app_name=settings.app_name,
        version=settings.app_version,
        debug=settings.debug,
    )


@router.get("/llm", response_model=LLMHealthResponse)
async def llm_health():
    """
    Returns which LLM providers are configured and their active models.
    Useful to confirm your API keys loaded correctly.
    """
    configured = llm_router.available_providers()

    active_models = {
        p: settings.get_active_llm_model(p)
        for p in configured
    }

    return LLMHealthResponse(
        default_provider=settings.default_llm_provider,
        configured_providers=configured,
        active_models=active_models,
    )