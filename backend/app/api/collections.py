

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.logging import get_logger
from app.services.vector_store import vector_store_service

logger = get_logger(__name__)
router = APIRouter(prefix="/collections", tags=["Collections"])


# ── Response schemas 

class CollectionListResponse(BaseModel):
    collections: list[str]
    total: int


class CollectionStatsResponse(BaseModel):
    name: str
    document_count: int
    exists: bool


class DeleteResponse(BaseModel):
    deleted: bool
    collection: str
    message: str


# ── Endpoints 

@router.get("", response_model=CollectionListResponse)
async def list_collections():
    """List all ChromaDB collections that currently exist."""
    names = vector_store_service.list_collections()
    logger.info("Listed %d collections", len(names))
    return CollectionListResponse(collections=names, total=len(names))


@router.get("/{name}/stats", response_model=CollectionStatsResponse)
async def collection_stats(name: str):
    """
    Return document count and existence status for a collection.
    Use this to check how many chunks a collection holds.
    """
    stats = vector_store_service.collection_stats(name)
    return CollectionStatsResponse(**stats)


@router.delete("/{name}", response_model=DeleteResponse)
async def delete_collection(name: str):
    """
    Permanently delete a collection and ALL its vectors.
    This cannot be undone — you would need to re-ingest the documents.
    """
    deleted = vector_store_service.delete_collection(name)

    if not deleted:
        raise HTTPException(
            status_code=404,
            detail=f"Collection '{name}' not found or could not be deleted.",
        )

    return DeleteResponse(
        deleted=True,
        collection=name,
        message=f"Collection '{name}' and all its vectors have been deleted.",
    )