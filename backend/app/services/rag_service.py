

from langchain_core.documents import Document

from app.core.config import settings
from app.core.logging import get_logger
from app.prompts.rag_prompt import RAG_PROMPT, format_context
from app.services.llm_service import llm_router
from app.services.vector_store import vector_store_service

logger = get_logger(__name__)

# Minimum similarity score to accept a retrieved chunk.
# Cosine similarity: 0.0 = completely unrelated, 1.0 = identical.
# Chunks below this threshold are too distant from the question to be useful.
# Simple: if the GPS coordinates are too far away, the sticky note isn't relevant.
MIN_RELEVANCE_SCORE = 0.30


class RAGService:
    """
    Orchestrates the full 5-stage RAG pipeline.
    """

    # ── Stage 1: Retrieve 

    def _retrieve(
        self,
        question: str,
        collection_name: str | None,
        k: int | None,
    ) -> list[tuple[Document, float]]:
        """
        Embed the question and find the top-K most similar chunks.
        """
        logger.info(
            "Stage 1 RETRIEVE | question='%.60s...' | collection=%s",
            question,
            collection_name or settings.chroma_collection_name,
        )

        results = vector_store_service.similarity_search_with_score(
            query=question,
            k=k or settings.retriever_top_k,
            collection_name=collection_name,
        )

        logger.info("Retrieved %d raw chunks", len(results))
        return results

    # ── Stage 2: Guard — relevance filter 

    def _filter_relevant(
        self,
        chunks: list[tuple[Document, float]],
    ) -> list[tuple[Document, float]]:
        """
        Remove chunks whose similarity score is below MIN_RELEVANCE_SCORE.
        """
        filtered = [
            (doc, score)
            for doc, score in chunks
            if score >= MIN_RELEVANCE_SCORE
        ]

        if len(filtered) < len(chunks):
            logger.info(
                "Stage 2 FILTER | kept %d/%d chunks (score >= %.0f%%)",
                len(filtered), len(chunks), MIN_RELEVANCE_SCORE * 100,
            )

        return filtered

    # ── Stage 3: Build prompt 

    def _build_prompt(
        self,
        question: str,
        chunks: list[tuple[Document, float]],
    ):
        """
        Format retrieved chunks into context and assemble the full prompt.
        """
        logger.info("Stage 3 BUILD | chunks_used=%d", len(chunks))

        context_str = format_context(chunks)
        messages = RAG_PROMPT.format_messages(
            context=context_str,
            question=question,
        )

        logger.debug(
            "Prompt assembled | context_length=%d chars", len(context_str)
        )
        return messages

    # ── Stage 4: Generate 

    async def _generate(
        self,
        messages: list,
        provider: str | None,
    ) -> tuple[str, str, str]:
        """
        Send the prompt to the LLM and get the answer back.

        """
        active_provider = provider or settings.default_llm_provider
        active_model    = settings.get_active_llm_model(active_provider)

        logger.info(
            "Stage 4 GENERATE | provider=%s | model=%s",
            active_provider, active_model,
        )

        llm      = llm_router.get_llm(active_provider)
        response = await llm.ainvoke(messages)

        # response.content is the raw answer string from the LLM
        answer = response.content.strip()
        logger.info("Generation complete | answer_length=%d chars", len(answer))

        return answer, active_provider, active_model

    # ── Stage 5: Package response 

    def _package_sources(
        self,
        chunks: list[tuple[Document, float]],
    ) -> list[dict]:
        """
        Convert retrieved chunks into clean source citation objects.
        """
        sources = []
        seen = set()  # deduplicate: don't show same source+page twice

        for doc, score in chunks:
            source = doc.metadata.get("source", "Unknown")
            page   = doc.metadata.get("page",   None)
            key    = (source, page)

            if key in seen:
                continue
            seen.add(key)

            sources.append({
                "content": doc.page_content.strip(),
                "source":  source,
                "page":    (page + 1) if page is not None else None,  # 1-indexed
                "score":   round(score, 4),
            })

        return sources

    # ── Public: full pipeline 

    async def answer(
        self,
        question: str,
        provider: str | None = None,
        collection_name: str | None = None,
        k: int | None = None,
    ) -> dict:
        """
        Run the full 5-stage RAG pipeline for one question.

        """
        logger.info(
            "━━━ RAG START | question='%.80s...'", question
        )

        # Stage 1 — Retrieve
        raw_chunks = self._retrieve(question, collection_name, k)

        # Stage 2 — Guard: filter low-relevance chunks
        relevant_chunks = self._filter_relevant(raw_chunks)

        # If NOTHING passed the relevance filter, skip the LLM entirely.
        # Calling the LLM with empty/irrelevant context just wastes API quota
        # and produces a hallucinated answer. Better to be honest upfront.
        if not relevant_chunks:
            logger.warning(
                "No relevant chunks found for question='%.60s...'", question
            )
            active_provider = provider or settings.default_llm_provider
            return {
                "answer":   (
                    "I don't have enough information in the provided documents "
                    "to answer this question. Please make sure the relevant "
                    "documents have been uploaded and ingested."
                ),
                "provider": active_provider,
                "model":    settings.get_active_llm_model(active_provider),
                "sources":  [],
            }

        # Stage 3 — Build prompt
        messages = self._build_prompt(question, relevant_chunks)

        # Stage 4 — Generate answer
        answer, active_provider, active_model = await self._generate(
            messages, provider
        )

        # Stage 5 — Package sources
        sources = self._package_sources(relevant_chunks)

        logger.info(
            "━━━ RAG DONE | provider=%s | sources=%d",
            active_provider, len(sources),
        )

        return {
            "answer":   answer,
            "provider": active_provider,
            "model":    active_model,
            "sources":  sources,
        }

    async def stream_answer(
        self,
        question: str,
        provider: str | None = None,
        collection_name: str | None = None,
        k: int | None = None,
    ):
        """
        Stream the answer token-by-token using async generator.


        """
        import json

        logger.info("━━━ RAG STREAM START | question='%.80s...'", question)

        # Stages 1-3 are identical to the non-streaming path
        raw_chunks      = self._retrieve(question, collection_name, k)
        relevant_chunks = self._filter_relevant(raw_chunks)

        active_provider = provider or settings.default_llm_provider
        active_model    = settings.get_active_llm_model(active_provider)

        if not relevant_chunks:
            # Yield a single "no context" message and stop
            yield "I don't have enough information in the provided documents to answer this question."
            yield f"\n[DONE]{json.dumps({'provider': active_provider, 'model': active_model, 'sources': []})}"
            return

        messages = self._build_prompt(question, relevant_chunks)
        sources  = self._package_sources(relevant_chunks)

        llm = llm_router.get_llm(active_provider)

        # astream() yields AIMessageChunk objects one token at a time.
        # Each chunk has a .content attribute with 1-3 words of the answer.
        async for chunk in llm.astream(messages):
            if chunk.content:
                yield chunk.content   # send this token to the frontend

        # After all tokens, send metadata as a final special message.
        # The frontend uses this to display sources and model info.
        yield f"\n[DONE]{json.dumps({'provider': active_provider, 'model': active_model, 'sources': sources})}"

        logger.info("━━━ RAG STREAM DONE | provider=%s", active_provider)


# ── Module-level singleton 
rag_service = RAGService()