

from fastapi import APIRouter, HTTPException, status
from fastapi.responses import StreamingResponse

from app.core.config import settings
from app.core.logging import get_logger
from app.schemas.qa_schema import QuestionRequest, QuestionResponse, SourceChunk
from app.services.rag_service import rag_service

logger = get_logger(__name__)
router = APIRouter(prefix="/chat", tags=["Chat / QA"])


# ── POST /chat/ask 

@router.post(
    "/ask",
    response_model=QuestionResponse,
    status_code=status.HTTP_200_OK,
    summary="Ask a question (standard)",
    description=(
        "Submit a question and receive a complete answer once the LLM finishes. "
        "The response includes the answer text, the LLM model used, "
        "and the source document chunks that grounded the answer."
    ),
)
async def ask(request: QuestionRequest):
    """
    Standard (non-streaming) QA endpoint.
    """

    # Validate provider if explicitly passed
    if request.provider:
        valid_providers = ["groq", "gemini", "mistral"]
        if request.provider not in valid_providers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Invalid provider '{request.provider}'. "
                    f"Valid options: {valid_providers}"
                ),
            )

    logger.info(
        "POST /chat/ask | question='%.60s...' | provider=%s",
        request.question,
        request.provider or settings.default_llm_provider,
    )

    try:
        result = await rag_service.answer(
            question=request.question,
            provider=request.provider,
            collection_name=request.collection_name,
        )

        # Convert raw source dicts into typed SourceChunk objects
        sources = [SourceChunk(**s) for s in result["sources"]]

        return QuestionResponse(
            answer=result["answer"],
            provider=result["provider"],
            model=result["model"],
            sources=sources,
        )

    except ValueError as e:
        # Bad input (e.g. unknown provider passed through)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        )
    except Exception as e:
        logger.error("RAG pipeline error | %s", e, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while generating the answer: {e}",
        )


# ── POST /chat/ask/stream

@router.post(
    "/ask/stream",
    summary="Ask a question (streaming)",
    description=(
        "Submit a question and receive the answer as a stream of Server-Sent Events. "
        "Tokens arrive in real time as the LLM generates them. "
        "The final event contains source metadata as JSON after the [DONE] marker."
    ),
    response_class=StreamingResponse,
)
async def ask_stream(request: QuestionRequest):
    """
    Streaming QA endpoint using Server-Sent Events (SSE).

    Best for: Next.js frontends, creating a live typing effect.

    How to consume this in the frontend:
      const response = await fetch('/chat/ask/stream', { method: 'POST', body: ... })
      const reader = response.body.getReader()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const text = new TextDecoder().decode(value)
        if (text.includes('[DONE]')) {
          // parse metadata from text after [DONE]
        } else {
          appendToAnswer(text)   // show token in the UI
        }
      }

    SSE format used:
      data: <token>\n\n         — one token of the answer
      data: [DONE]{...json}\n\n — final event with sources + model info
    """

    if request.provider:
        valid_providers = ["groq", "gemini", "mistral"]
        if request.provider not in valid_providers:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid provider '{request.provider}'. Valid: {valid_providers}",
            )

    logger.info(
        "POST /chat/ask/stream | question='%.60s...' | provider=%s",
        request.question,
        request.provider or settings.default_llm_provider,
    )

    async def event_generator():
        """
        Async generator that yields SSE-formatted strings.

        SSE format is: "data: <content>\n\n"
        Each event is separated by a blank line.
        The browser's EventSource API parses this automatically.
        """
        try:
            async for token in rag_service.stream_answer(
                question=request.question,
                provider=request.provider,
                collection_name=request.collection_name,
            ):
                # Wrap each token in SSE format
                yield f"data: {token}\n\n"

        except Exception as e:
            logger.error("Streaming error | %s", e, exc_info=True)
            # Send the error as an SSE event so the frontend can handle it
            yield f"data: [ERROR]{str(e)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            # These headers keep the SSE connection alive and prevent caching.
            # Simple: they tell the browser "keep listening, don't cache this"
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",   # disables nginx buffering if present
        },
    )