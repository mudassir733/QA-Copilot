

from langchain_core.prompts import ChatPromptTemplate


RAG_SYSTEM_PROMPT = """You are a precise and helpful QA Co-Pilot assistant.
Your job is to answer questions based ONLY on the context documents provided to you.

Rules you must always follow:
1. Answer using ONLY the information in the context below. Do not use your general training knowledge.
2. If the context does not contain enough information to answer the question, say clearly:
   "I don't have enough information in the provided documents to answer this question."
3. Always be concise and direct. Do not pad your answer with filler phrases.
4. When you reference specific information, mention which source it came from (e.g. "According to [filename]...").
5. If the question can be partially answered, provide what you can and state what is missing.
6. Do not make up facts, statistics, or quotes. If it's not in the context, don't say it.

Context documents:
──────────────────
{context}
──────────────────
"""

# ── Human prompt
#
# This is the user's turn in the conversation.
# It's intentionally simple — the heavy lifting is in the system prompt.
# {question} is replaced at runtime with the actual user question.

RAG_HUMAN_PROMPT = "Question: {question}"


# ── Assembled template 


RAG_PROMPT = ChatPromptTemplate.from_messages([
    ("system", RAG_SYSTEM_PROMPT),
    ("human",  RAG_HUMAN_PROMPT),
])


# ── Context formatter

def format_context(chunks: list) -> str:
    if not chunks:
        return "No relevant context found."

    formatted_parts = []
    for doc, score in chunks:
        source   = doc.metadata.get("source", "Unknown source")
        page     = doc.metadata.get("page",   None)
        content  = doc.page_content.strip()

        # Build the source label line
        label = f"[Source: {source}"
        if page is not None:
            label += f" | Page: {page + 1}"   # +1 because PDF pages are 0-indexed
        label += f" | Relevance: {score:.0%}]"

        formatted_parts.append(f"{label}\n{content}")

    # Join all chunks with a clear visual separator
    return "\n\n".join(formatted_parts)