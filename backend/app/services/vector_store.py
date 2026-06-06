"""
app/services/vector_store.py

ChromaDB vector store — all read/write operations in one place.

Responsibilities:
  • Create / load a persistent ChromaDB collection
  • Add document chunks (with metadata) to the collection
  • Similarity search — retrieve top-K chunks for a query
  • Collection management — list, delete, stats

Why ChromaDB?
  • Runs entirely locally (no external service needed)
  • Persistent — data survives server restarts
  • LangChain native integration
  • Free and open source

Usage:
    from app.services.vector_store import vector_store_service

    # Add chunks
    vector_store_service.add_documents(docs, collection_name="my_docs")

    # Search
    results = vector_store_service.similarity_search("what is RAG?", k=4)
"""

import os
from typing import Any

import chromadb
from langchain_chroma import Chroma
from langchain_core.documents import Document

from app.core.config import settings
from app.core.logging import get_logger
from app.services.embeddings import embedding_service

logger = get_logger(__name__)


class VectorStoreService:
    """
    Manages ChromaDB collections and exposes clean search/write methods.

    Architecture:
      ┌─────────────────────────────────────────────┐
      │  VectorStoreService                         │
      │                                             │
      │  _chroma_client  → raw ChromaDB client      │
      │  _stores{}       → LangChain Chroma wrappers│
      │                    (one per collection)     │
      └─────────────────────────────────────────────┘

    The raw client is used for admin ops (list/delete collections).
    LangChain Chroma wrappers are used for document ops (add/search).
    """

    def __init__(self) -> None:
        self._chroma_client: chromadb.ClientAPI | None = None
        self._stores: dict[str, Chroma] = {}

    # ── Private: client & store getters 

    def _get_client(self) -> chromadb.ClientAPI:
        """Return the persistent ChromaDB client, creating it on first call."""
        if self._chroma_client is None:
            persist_dir = settings.chroma_persist_dir
            os.makedirs(persist_dir, exist_ok=True)

            self._chroma_client = chromadb.PersistentClient(path=persist_dir)
            logger.info("ChromaDB client ready | path=%s", persist_dir)

        return self._chroma_client

    def _get_store(self, collection_name: str | None = None) -> Chroma:
        """
        Return a LangChain Chroma wrapper for the given collection.
        Creates the collection if it does not exist.
        """
        name = collection_name or settings.chroma_collection_name

        if name not in self._stores:
            logger.info("Loading/creating ChromaDB collection | name=%s", name)
            self._stores[name] = Chroma(
                client=self._get_client(),
                collection_name=name,
                embedding_function=embedding_service.get_embeddings(),
                # cosine is better than Euclidean for semantic text similarity
                collection_metadata={"hnsw:space": "cosine"},
            )
            logger.debug("Collection ready | name=%s", name)

        return self._stores[name]

    # ── Write operations 

    def add_documents(
        self,
        documents: list[Document],
        collection_name: str | None = None,
    ) -> int:
        """
        Add LangChain Documents to the vector store.

        Each Document must have:
          .page_content  → the text chunk
          .metadata      → dict with at least {"source": "filename.pdf"}

        Returns the number of documents added.
        """
        if not documents:
            logger.warning("add_documents called with empty list — skipping")
            return 0

        store = self._get_store(collection_name)
        store.add_documents(documents)

        count = len(documents)
        logger.info(
            "Added %d chunks to collection '%s'",
            count,
            collection_name or settings.chroma_collection_name,
        )
        return count

    # ── Read operations

    def similarity_search(
        self,
        query: str,
        k: int | None = None,
        collection_name: str | None = None,
        filter: dict[str, Any] | None = None,
    ) -> list[Document]:
        """
        Find the top-K most semantically similar chunks to `query`.

        Args:
            query:           The user's question (plain text)
            k:               How many chunks to retrieve (default from settings)
            collection_name: Which collection to search (default from settings)
            filter:          Optional metadata filter e.g. {"source": "report.pdf"}

        Returns:
            List of LangChain Documents (chunk text + metadata)
        """
        top_k = k or settings.retriever_top_k
        store = self._get_store(collection_name)

        logger.debug(
            "Similarity search | query='%.60s...' k=%d", query, top_k
        )

        results = store.similarity_search(
            query=query,
            k=top_k,
            filter=filter,
        )

        logger.debug("Retrieved %d chunks", len(results))
        return results

    def similarity_search_with_score(
        self,
        query: str,
        k: int | None = None,
        collection_name: str | None = None,
    ) -> list[tuple[Document, float]]:
        """
        Same as similarity_search but also returns cosine similarity scores.
        Score range: 0.0 (unrelated) → 1.0 (identical).
        Used when the response needs to show confidence scores.
        """
        top_k = k or settings.retriever_top_k
        store = self._get_store(collection_name)

        results = store.similarity_search_with_score(query=query, k=top_k)
        logger.debug(
            "Retrieved %d chunks with scores | top_score=%.3f",
            len(results),
            results[0][1] if results else 0,
        )
        return results

    # ── Collection management 

    def list_collections(self) -> list[str]:
        """Return names of all existing ChromaDB collections."""
        client = self._get_client()
        collections = client.list_collections()
        return [col.name for col in collections]

    def collection_stats(self, collection_name: str | None = None) -> dict:
        """Return document count and metadata for a collection."""
        name = collection_name or settings.chroma_collection_name
        client = self._get_client()

        try:
            col = client.get_collection(name)
            return {
                "name": name,
                "document_count": col.count(),
                "exists": True,
            }
        except Exception:
            return {"name": name, "document_count": 0, "exists": False}

    def delete_collection(self, collection_name: str) -> bool:
        """
        Permanently delete a collection and all its vectors.
        Returns True if deleted, False if it did not exist.
        """
        client = self._get_client()
        try:
            client.delete_collection(collection_name)
            # Remove from local cache too
            self._stores.pop(collection_name, None)
            logger.warning("Deleted collection '%s'", collection_name)
            return True
        except Exception as e:
            logger.error("Failed to delete collection '%s': %s", collection_name, e)
            return False

    def delete_by_source(
        self,
        source: str,
        collection_name: str | None = None,
    ) -> int:
        """
        Delete all chunks that came from a specific file.
        Useful when a document is re-uploaded and needs to be refreshed.
        Returns number of deleted chunks.
        """
        store = self._get_store(collection_name)
        # ChromaDB supports metadata filtering on delete
        store._collection.delete(where={"source": source})
        logger.info("Deleted chunks from source='%s'", source)
        # ChromaDB doesn't return a count on delete — return 0 as placeholder
        return 0

    def reset(self) -> None:
        """Clear in-memory cache (does NOT delete persisted data)."""
        self._stores.clear()
        self._chroma_client = None
        logger.debug("VectorStoreService cache cleared")


# ── Module-level singleton 
vector_store_service = VectorStoreService()