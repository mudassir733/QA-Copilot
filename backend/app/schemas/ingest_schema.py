

from pydantic import BaseModel, Field


# ── Upload response 

class IngestResponse(BaseModel):
    """
    Returned after a successful document upload + ingestion.
    Tells the frontend exactly what happened to the file.
    """
    success: bool       = Field(..., description="Whether ingestion succeeded")
    filename: str       = Field(..., description="Original uploaded filename")
    file_type: str      = Field(..., description="Detected file type: pdf | txt | docx")
    chunk_count: int    = Field(..., description="Number of chunks stored in ChromaDB")
    collection_name: str= Field(..., description="ChromaDB collection the chunks were stored in")
    message: str        = Field(..., description="Human-readable summary")


# ── Source list response 

class SourceDocument(BaseModel):
    """
    Represents one document (file) that has already been ingested.
    A single file = many chunks, but we surface it as one source.
    """
    source: str         = Field(..., description="Original filename")
    chunk_count: int    = Field(..., description="How many chunks this file produced")
    collection_name: str= Field(..., description="Which ChromaDB collection it lives in")


class SourceListResponse(BaseModel):
    sources: list[SourceDocument]
    total: int


# ── Delete source response 

class DeleteSourceResponse(BaseModel):
    success: bool
    source: str
    message: str