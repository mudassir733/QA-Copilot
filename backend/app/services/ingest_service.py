"""
app/services/ingest_service.py

The ingestion pipeline — turns an uploaded file into searchable vectors.

Pipeline stages:
  1. LOAD    → read raw text from the file (PDF / TXT / DOCX)
  2. SPLIT   → chop text into overlapping chunks
  3. ENRICH  → attach metadata (source filename, page number, chunk index)
  4. STORE   → embed each chunk and save to ChromaDB

Nothing in this file touches the HTTP layer.
The API endpoint (ingest.py) calls this service and handles HTTP concerns.

Usage:
    from app.services.ingest_service import ingest_service
    result = await ingest_service.ingest_file(file_path, original_filename, collection_name)
"""

import os
from pathlib import Path

from langchain_core.documents import Document
from langchain_community.document_loaders import PyPDFLoader, TextLoader
from langchain_community.document_loaders import Docx2txtLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import settings
from app.core.logging import get_logger
from app.services.vector_store import vector_store_service

logger = get_logger(__name__)

# File types we support — maps extension → loader class
SUPPORTED_EXTENSIONS = {
    ".pdf":  "pdf",
    ".txt":  "txt",
    ".md":   "txt",   # Markdown is plain text
    ".docx": "docx",
}


class IngestService:
  

    def __init__(self) -> None:
        # RecursiveCharacterTextSplitter is LangChain's smartest splitter.
        # It tries to split on paragraphs → sentences → words → characters,
        # in that order, so chunks always break at natural boundaries.
        #
        # chunk_size    = max characters per chunk (not tokens — simpler to compute)
        # chunk_overlap = how many characters the next chunk re-reads from the prev one
        #
        # Simple analogy: if you're cutting a pizza into slices,
        # overlap means each slice shares a bit of crust with its neighbour
        # so no topping falls through the gap.
        self._splitter = RecursiveCharacterTextSplitter(
            chunk_size=settings.chunk_size * 4,   # *4 converts tokens → ~characters
            chunk_overlap=settings.chunk_overlap * 4,
            separators=["\n\n", "\n", ". ", " ", ""],  # try these split points in order
            length_function=len,
        )

    # ── Stage 1: Load 

    def _load_document(self, file_path: str, file_type: str) -> list[Document]:
        """
        Read raw text from a file using the appropriate LangChain loader.

        LangChain loaders return a list of Document objects.
        Each Document has:
          .page_content → the text on that page / section
          .metadata     → dict with at least {"source": "/path/to/file"}

        For PDFs, each page becomes one Document.
        For TXT/DOCX, the whole file is typically one Document.
        """
        logger.info("Stage 1 LOAD | file_type=%s | path=%s", file_type, file_path)

        if file_type == "pdf":
            # PyPDFLoader extracts text page-by-page, preserving page numbers
            loader = PyPDFLoader(file_path)

        elif file_type == "txt":
            # TextLoader reads the whole file as a single document
            loader = TextLoader(file_path, encoding="utf-8")

        elif file_type == "docx":
            # Docx2txtLoader extracts text from Word documents
            loader = Docx2txtLoader(file_path)

        else:
            raise ValueError(f"Unsupported file type: {file_type}")

        docs = loader.load()
        logger.info("Loaded %d page(s)/section(s) from file", len(docs))
        return docs

    # ── Stage 2: Split 

    def _split_documents(self, documents: list[Document]) -> list[Document]:
        """
        Chop each document into smaller overlapping chunks.

        Why overlap? Imagine a sentence is split exactly at a comma:
          Chunk 1: "The capital of France is"
          Chunk 2: "Paris, which is also the largest city"

        Without overlap, neither chunk contains the full fact.
        With overlap, chunk 2 starts a few words before "Paris",
        so the complete sentence appears in at least one chunk.
        """
        logger.info("Stage 2 SPLIT | input_pages=%d", len(documents))
        chunks = self._splitter.split_documents(documents)
        logger.info("Split into %d chunks", len(chunks))
        return chunks

    # ── Stage 3: Enrich metadata 

    def _enrich_metadata(
        self,
        chunks: list[Document],
        original_filename: str,
    ) -> list[Document]:
        """
        Attach clean metadata to every chunk before storing.

        Why metadata matters:
          When the AI answers "What does page 3 say about X?", the metadata
          is how we know which chunk came from which file and page.
          Without it, the answer has no source citation.

        We standardise the 'source' key to the original filename (not the
        temp path on disk), so it's human-readable in the response.
        """
        logger.info("Stage 3 ENRICH | chunks=%d | filename=%s", len(chunks), original_filename)

        for i, chunk in enumerate(chunks):
            # Preserve the page number if the loader set it (PDFs do)
            page = chunk.metadata.get("page", None)

            chunk.metadata.update({
                "source":      original_filename,   # clean display name
                "chunk_index": i,                   # position in the document
                "total_chunks": len(chunks),        # total chunk count
                **({"page": page} if page is not None else {}),
            })

        return chunks

    # ── Stage 4: Store 
    # (delegated entirely to vector_store_service — no duplication)

    # ── Public: full pipeline

    async def ingest_file(
        self,
        file_path: str,
        original_filename: str,
        collection_name: str | None = None,
    ) -> dict:
        """
        Run the full 4-stage pipeline for one file.

        Args:
            file_path:         Absolute path to the saved temp file on disk
            original_filename: The name the user gave the file (e.g. "report.pdf")
            collection_name:   Which ChromaDB collection to store into

        Returns a dict with ingestion results (chunk_count, collection, etc.)
        """
        # Detect file type from extension
        ext = Path(original_filename).suffix.lower()
        file_type = SUPPORTED_EXTENSIONS.get(ext)

        if not file_type:
            raise ValueError(
                f"Unsupported file type '{ext}'. "
                f"Supported: {list(SUPPORTED_EXTENSIONS.keys())}"
            )

        logger.info(
            "━━━ Ingestion START | file=%s | collection=%s",
            original_filename,
            collection_name or settings.chroma_collection_name,
        )

        try:
            # Before adding new chunks, remove any old ones from this source.
            # This handles the "re-upload" case: user uploads an updated document.
            # Without this step, the old and new versions would both exist in
            # ChromaDB and the AI would get confused by conflicting information.
            vector_store_service.delete_by_source(original_filename, collection_name)
            logger.debug("Cleared old chunks for source='%s'", original_filename)

            # ── Run the 4 stages 
            raw_docs  = self._load_document(file_path, file_type)       # Stage 1
            chunks    = self._split_documents(raw_docs)                  # Stage 2
            chunks    = self._enrich_metadata(chunks, original_filename) # Stage 3
            count     = vector_store_service.add_documents(             # Stage 4
                chunks, collection_name
            )
            

            logger.info(
                "━━━ Ingestion DONE | file=%s | chunks=%d",
                original_filename, count,
            )

            return {
                "success":         True,
                "filename":        original_filename,
                "file_type":       file_type,
                "chunk_count":     count,
                "collection_name": collection_name or settings.chroma_collection_name,
                "message": (
                    f"'{original_filename}' successfully ingested into "
                    f"{count} searchable chunks."
                ),
            }

        except Exception as e:
            logger.error("Ingestion FAILED | file=%s | error=%s", original_filename, e)
            raise

        finally:
            # Always clean up the temp file from disk regardless of success/failure.
            # The data now lives in ChromaDB — we don't need the file anymore.
            if os.path.exists(file_path):
                os.remove(file_path)
                logger.debug("Temp file removed: %s", file_path)

    def get_ingested_sources(self, collection_name: str | None = None) -> list[dict]:
        """
        Return a deduplicated list of all source documents in a collection.

        ChromaDB stores individual chunks, not whole files.
        This method groups chunks by their 'source' metadata field
        so we can show the user a clean list of "which files are ingested".
        """
        from langchain_chroma import Chroma
        from app.services.embeddings import embedding_service
        import chromadb

        target_collection = collection_name or settings.chroma_collection_name

        try:
            client = chromadb.PersistentClient(path=settings.chroma_persist_dir)
            col = client.get_collection(target_collection)

            # Get ALL metadata records (no embeddings needed — metadata only)
            # This is the only place we bypass the LangChain wrapper
            # because we need raw metadata access, not a similarity search.
            result = col.get(include=["metadatas"])

            # Count chunks per source file
            source_counts: dict[str, int] = {}
            for meta in result["metadatas"]:
                src = meta.get("source", "unknown")
                source_counts[src] = source_counts.get(src, 0) + 1

            return [
                {
                    "source":          src,
                    "chunk_count":     count,
                    "collection_name": target_collection,
                }
                for src, count in sorted(source_counts.items())
            ]

        except Exception as e:
            logger.warning("Could not fetch sources: %s", e)
            return []


# ── Module-level singleton 
ingest_service = IngestService()