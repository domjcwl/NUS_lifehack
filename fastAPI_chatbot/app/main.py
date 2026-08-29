"""The Floe recycling chatbot service.

    python -m uvicorn app.main:app --reload --port 8000

Interactive docs at http://127.0.0.1:8000/docs.

This service owns the chatbot and nothing else. Identity, bins-on-a-map, photo
verification, points, groups and the impact model all live in `web/` — see the
Sat 15:30 entry in docs/decisions.md. Two implementations of one product is the
failure mode this repo has already corrected once.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.rag import store
from app.routers import chat
from app.tools import bins

logging.basicConfig(
    level=logging.DEBUG if settings.DEBUG else logging.INFO,
    format="%(levelname)s %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Load the corpus and the bin dataset before the first request.

    Reading 1.5 MB of JSON on request one would put a visible pause on the first
    question a judge asks. Do it at startup instead, and log what actually loaded
    so a bad BINS_PATH is obvious in the terminal rather than at the table.
    """
    logger.info(
        "%s ready - %d chunks, %d bins, model %s",
        settings.APP_NAME,
        len(store.corpus()),
        bins.count(),
        "configured" if settings.openai_enabled else "NOT configured (offline answers)",
    )
    yield


app = FastAPI(
    title=settings.APP_NAME,
    description=(
        "Recycling and e-waste answers for Singapore, grounded in NEA guidance. "
        "Works with or without an OpenAI key."
    ),
    version="1.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)


@app.get("/", include_in_schema=False)
async def root() -> dict[str, str]:
    return {"service": settings.APP_NAME, "docs": "/docs", "health": "/health"}
