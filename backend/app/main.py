"""FastAPI application entry point."""

from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.core.logging import get_logger, setup_logging
from app.database import create_db_and_tables
from app.routers import activities, bins, recycle, users

logger = get_logger(__name__)

DESCRIPTION = """
Backend for **BinBuddy**, a gamified recycling app for the NUS LifeHack 2026
sustainability brief.

The behavioural loop this API exists to support:

`Education -> Discovery -> Action -> Proof -> Reward -> Social recognition -> Repeat`

**There is no login.** Create a user with `POST /users`, keep the returned `id`, and
send it as `?user_id=<id>` (or an `X-User-Id` header) on any endpoint that needs to know
who is acting. No tokens, no Authorize button.
"""


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    create_db_and_tables()
    logger.info("%s starting in %s mode", settings.APP_NAME, settings.ENV)
    if not settings.openai_enabled:
        logger.info("No OPENAI_API_KEY set. AI features will use their offline fallbacks.")
    yield
    logger.info("%s shutting down", settings.APP_NAME)


def create_app() -> FastAPI:
    app = FastAPI(
        title=f"{settings.APP_NAME} API",
        description=DESCRIPTION,
        version="0.1.0",
        lifespan=lifespan,
        docs_url="/docs",
        redoc_url="/redoc",
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Uploaded proof photos are served straight off disk in development. Swapping
    # StorageService to S3 later changes the returned URL and nothing else.
    upload_dir = Path(settings.STORAGE_DIR)
    upload_dir.mkdir(parents=True, exist_ok=True)
    app.mount("/media", StaticFiles(directory=upload_dir), name="media")

    app.include_router(users.router, prefix=settings.API_PREFIX)
    app.include_router(bins.router, prefix=settings.API_PREFIX)
    app.include_router(recycle.router, prefix=settings.API_PREFIX)
    app.include_router(activities.router, prefix=settings.API_PREFIX)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(request: Request, exc: RequestValidationError):
        """Collapse Pydantic's nested error list into the API's single `detail` string."""
        first = exc.errors()[0] if exc.errors() else {}
        location = ".".join(str(p) for p in first.get("loc", ()) if p != "body")
        message = first.get("msg", "Invalid input")
        detail = f"{location}: {message}" if location else message
        return JSONResponse(status_code=422, content={"detail": detail})

    @app.exception_handler(Exception)
    async def unhandled_handler(request: Request, exc: Exception):
        """Last line of defence: log the trace, return a clean body, never leak internals."""
        logger.exception("Unhandled error on %s %s", request.method, request.url.path)
        return JSONResponse(
            status_code=500, content={"detail": "Internal server error"}
        )

    @app.get("/", tags=["meta"], summary="Service metadata")
    def root() -> dict[str, str]:
        return {
            "name": settings.APP_NAME,
            "status": "ok",
            "docs": "/docs",
            "version": "0.1.0",
        }

    @app.get("/health", tags=["meta"], summary="Liveness probe")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    return app


app = create_app()
