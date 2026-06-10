

import os
import uuid

from fastapi import APIRouter, File, Form, HTTPException, UploadFile, status

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.ingest_schema import (
    DeleteSourceResponse,
    IngestResponse,
    SourceListResponse,
    SourceDocument,
)
from app.services.ingest_service import ingest_service
from app.services.vector_store import vector_store_service

logger = get_logger(__name__)
router = APIRouter(prefix="/ingest", tags=["Ingestion"])

# Allowed MIME types — guards against users uploading executables, images etc.
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",  # .docx
}

ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".docx"}


# ── POST /ingest/upload

@router.post(
    "/upload",
    response_model=IngestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload and ingest a document",
    description=(
        "Upload a PDF, TXT, or DOCX file. "
        "The file is split into chunks, embedded, and stored in ChromaDB "
        "so it can be searched during question answering."
    ),
)
async def upload_document(
    file: UploadFile = File(..., description="The document to ingest (PDF, TXT, DOCX)"),
    collection_name: str = Form(
        default=None,
        description="ChromaDB collection name. Leave empty to use the server default.",
    ),
):
    """
    Full ingestion flow:
      1. Validate file (size, extension, mime type)
      2. Save to a temp path on disk with a unique name
      3. Hand off to ingest_service which runs the 4-stage pipeline
      4. Return the result
    """

    # ── Guard: filename must exist
    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must have a filename.",
        )

    original_filename = file.filename

    # ── Guard: file extension 
    # Simple: "is this a type of file we can read?"
    ext = os.path.splitext(original_filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                f"File type '{ext}' is not supported. "
                f"Allowed types: {sorted(ALLOWED_EXTENSIONS)}"
            ),
        )

    # ── Guard: file size 
    # We read the file into memory to check size before saving to disk.
    # This prevents giant files from filling up the server's storage.
    content = await file.read()
    file_size = len(content)

    if file_size > settings.max_upload_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=(
                f"File size {file_size / 1_048_576:.1f} MB exceeds "
                f"the {settings.max_upload_size_mb} MB limit."
            ),
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    # ── Save to temp path 
    # We give the temp file a UUID prefix so two users uploading "report.pdf"
    # at the same time don't overwrite each other's files.
    # The original filename is passed separately to the ingest service.
    os.makedirs(settings.upload_dir, exist_ok=True)
    temp_filename = f"{uuid.uuid4().hex}_{original_filename}"
    temp_path = os.path.join(settings.upload_dir, temp_filename)

    try:
        with open(temp_path, "wb") as f:
            f.write(content)
        logger.info(
            "File saved | original=%s | temp=%s | size=%.1f KB",
            original_filename,
            temp_filename,
            file_size / 1024,
        )
    except OSError as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to save uploaded file: {e}",
        )

    # ── Run ingestion pipeline 
    try:
        result = await ingest_service.ingest_file(
            file_path=temp_path,
            original_filename=original_filename,
            collection_name=collection_name or None,
        )
        return IngestResponse(**result)

    except ValueError as e:
        # Unsupported file type or bad content — client's fault
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(e),
        )
    except Exception as e:
        logger.error("Ingestion error | file=%s | %s", original_filename, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Ingestion failed: {e}",
        )


# ── GET /ingest/sources 

@router.get(
    "/sources",
    response_model=SourceListResponse,
    summary="List all ingested documents",
    description="Returns every document that has been ingested, with its chunk count.",
)
async def list_sources(
    collection_name: str | None = None,
):
    """
    Reads chunk metadata from ChromaDB and groups by source filename.
    No LLM or embedding call needed — pure metadata lookup.
    """
    sources_raw = ingest_service.get_ingested_sources(collection_name)
    sources = [SourceDocument(**s) for s in sources_raw]

    return SourceListResponse(sources=sources, total=len(sources))


# ── DELETE /ingest/source/{source_name} 

@router.delete(
    "/source/{source_name:path}",
    response_model=DeleteSourceResponse,
    summary="Remove a document's chunks from ChromaDB",
    description=(
        "Deletes all chunks that came from the named source file. "
        "The source_name must exactly match the original filename used during upload."
    ),
)
async def delete_source(
    source_name: str,
    collection_name: str | None = None,
):
    """
    Useful when:
      • A document was uploaded by mistake
      • The document is outdated and should be replaced
      • You want to reduce the knowledge base size
    """
    try:
        vector_store_service.delete_by_source(source_name, collection_name)
        logger.info("Deleted source | name=%s", source_name)

        return DeleteSourceResponse(
            success=True,
            source=source_name,
            message=f"All chunks from '{source_name}' have been removed.",
        )

    except Exception as e:
        logger.error("Delete source failed | name=%s | error=%s", source_name, e)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to delete source: {e}",
        )