

import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.logging import get_logger, setup_logging

# ── Import routers 
from app.api import health, collections, ingest
logger = get_logger(__name__)

# ── Lifespan (replaces deprecated @app.on_event) 
@asynccontextmanager
async def lifespan(app: FastAPI):
    # ── Startup 
    setup_logging()
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
    logger.info("  %s  v%s  starting up", settings.app_name, settings.app_version)
    logger.info("  Default LLM provider : %s", settings.default_llm_provider)
    logger.info("  Embedding provider   : %s", settings.embedding_provider)
    logger.info("  ChromaDB directory   : %s", settings.chroma_persist_dir)
    logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━")
 
    # Ensure required directories exist
    for directory in [settings.upload_dir, settings.chroma_persist_dir]:
        os.makedirs(directory, exist_ok=True)
        logger.debug("Directory ready: %s", directory)
 
    yield  # ← app runs here
 
    # ── Shutdown 
    logger.info("%s shutting down. Bye!", settings.app_name)
 
 
# ── App factory 
app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "QA Co-Pilot API — RAG-powered question answering "
        "over your own documents using LangChain + ChromaDB."
    ),
    lifespan=lifespan,
    docs_url="/docs",       # Swagger UI
    redoc_url="/redoc",     # ReDoc UI
)
 
 
# ── CORS
# Allows the Next.js dev server and production domain to call this API.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # Next.js dev
        "http://localhost:3001",   # alternate dev port
        # Add your production domain here later, e.g.:
        # "https://your-app.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
 
 
# ── Register Routers
app.include_router(health.router)
app.include_router(collections.router)
app.include_router(ingest.router)
# Step 4: app.include_router(chat.router)
 
 
# ── Root 
@app.get("/", tags=["Root"])
async def root():
    return {
        "message": f"Welcome to {settings.app_name}",
        "version": settings.app_version,
        "docs": "/docs",
    }