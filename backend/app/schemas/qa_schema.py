from pydantic import BaseModel, Field


class QuestionRequest(BaseModel):
    question: str = Field(..., min_length=3, description="The user's question")
    provider: str | None = Field(
        default=None,
        description="LLM provider override: 'groq' | 'gemini' | 'mistral'. "
                    "Omit to use the server default.",
    )
    collection_name: str | None = Field(
        default=None,
        description="ChromaDB collection to search. Omit for the default collection.",
    )



class SourceChunk(BaseModel):
    content: str = Field(..., description="The retrieved text chunk")
    source: str = Field(..., description="Filename or URL the chunk came from")
    page: int | None = Field(default=None, description="Page number if applicable")
    score: float | None = Field(default=None, description="Similarity score (0–1)")


class QuestionResponse(BaseModel):
    answer: str = Field(..., description="LLM-generated answer")
    provider: str = Field(..., description="LLM provider that generated the answer")
    model: str = Field(..., description="Exact model used")
    sources: list[SourceChunk] = Field(
        default_factory=list,
        description="Document chunks used to generate the answer",
    )