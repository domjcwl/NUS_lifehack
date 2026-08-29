"""Chat and health routes."""

import logging

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app.config import settings
from app.graph import build
from app.rag import store
from app.schemas import (
    BinLocation,
    ChatRequest,
    ChatResponse,
    HealthResponse,
    ResolvedLocation,
    Source,
)
from app.tools import bins as bin_tool
from app.tools import geocode

logger = logging.getLogger(__name__)

router = APIRouter()

DESCRIPTION = """
Answers recycling and e-waste questions for Singapore.

Runs a **LangGraph** state machine, not a single model call:

`contextualize -> classify -> retrieve -> resolve_location -> find_bins -> generate -> ground check`

Retrieval is BM25 over a curated Singapore knowledge base plus any ingested NEA
documents. A place the user names ("I'm at Raffles Hall") is geocoded, so the bin
finder can search 13,004 real NEA collection points without the device sharing
coordinates. The ground check verifies the answer against what was retrieved.

All of that runs with or without an API key, so **this endpoint works offline** —
without `OPENAI_API_KEY` it answers from the knowledge base verbatim rather than
generating a reply, and says so via `used_model: false`.

When nothing matches, it says it does not know instead of guessing. Check
`grounded` before presenting an answer confidently.
"""


@router.post(
    "/chat",
    response_model=ChatResponse,
    summary="Ask a recycling or e-waste question",
    description=DESCRIPTION,
    tags=["chat"],
)
async def chat(payload: ChatRequest) -> ChatResponse:
    location = payload.location
    # The graph is synchronous and the model call blocks, so keep it off the event loop.
    state = await run_in_threadpool(
        build.ask,
        [m.model_dump() for m in payload.messages],
        location.latitude if location else None,
        location.longitude if location else None,
    )

    sources = []
    for chunk, _score in state.get("chunks", []):
        title, url, quoted = store.source_of(chunk)
        sources.append(
            Source(
                id=chunk.id,
                topic=chunk.topic,
                title=title,
                url=url,
                quoted=quoted,
                snippet=chunk.text,
            )
        )

    locations = [
        BinLocation(
            name=n.bin.name,
            kind=n.bin.kind,
            postal=n.bin.postal,
            streams=list(n.bin.streams),
            latitude=n.bin.lat,
            longitude=n.bin.lng,
            metres=n.metres,
            directions_url=n.directions_url,
        )
        for n in state.get("bins", [])
    ]

    resolved = state.get("resolved_place")

    return ChatResponse(
        answer=state["answer"],
        intent=state.get("intent", "unknown"),
        sources=sources,
        locations=locations,
        resolved_location=(
            ResolvedLocation(
                name=resolved.name,
                latitude=resolved.latitude,
                longitude=resolved.longitude,
                source=resolved.source,
            )
            if resolved
            else None
        ),
        needs_location=state.get("needs_location", False),
        grounded=state.get("grounded", False),
        used_model=state.get("used_model", False),
        notes=state.get("notes", []),
    )


@router.get(
    "/health",
    response_model=HealthResponse,
    summary="Service health",
    description="Enough to diagnose a broken demo in one curl: whether the "
    "knowledge base and the bin dataset actually loaded, and whether a model key "
    "is configured.",
    tags=["ops"],
)
async def health() -> HealthResponse:
    return HealthResponse(
        status="ok",
        chunks=len(store.corpus()),
        bins=bin_tool.count(),
        places_cached=geocode.cached_count(),
        model_configured=settings.openai_enabled,
    )
