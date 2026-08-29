"""Chatbot route."""

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.agents.chatbot import graph
from app.core.logging import get_logger
from app.schemas.chat import ChatRequest, ChatResponse, ChatSource

logger = get_logger(__name__)

router = APIRouter(tags=["chat"])

DESCRIPTION = """
Answers recycling and waste-disposal questions for Singapore.

Runs a **LangGraph** state machine, not a single model call:

`classify -> retrieve -> generate -> ground check`

Retrieval is BM25 over a curated Singapore knowledge base, and the ground check verifies
the answer against what was retrieved. Both run with or without an API key, so **this
endpoint works offline** - without `ANTHROPIC_API_KEY` it answers from the knowledge base
verbatim rather than generating a reply, and says so via `used_model: false`.

When nothing in the knowledge base matches, it says it does not know instead of guessing.
Check `grounded` before presenting an answer confidently.
"""


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Ask a recycling question",
    description=DESCRIPTION,
)
async def chat(payload: ChatRequest) -> ChatResponse:
    # The graph is synchronous and the model call blocks, so keep it off the event loop.
    state = await run_in_threadpool(graph.ask, payload.message)

    return ChatResponse(
        answer=state["answer"],
        category=state.get("category", "unknown"),
        sources=[
            ChatSource(id=chunk.id, topic=chunk.topic, text=chunk.text)
            for chunk, _ in state.get("chunks", [])
        ],
        grounded=state.get("grounded", False),
        used_model=state.get("used_model", False),
        notes=state.get("notes", []),
    )
