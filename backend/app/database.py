"""Database engine and session management.

Deliberately synchronous. Mixing `async def` handlers with a synchronous driver blocks
the event loop; FastAPI already runs plain `def` handlers in a threadpool, so sync
sessions plus `def` handlers is both correct and simpler. `async def` is reserved for
routes that do real network I/O (chatbot, news, directions).
"""

from collections.abc import Generator

from sqlalchemy import Engine
from sqlmodel import Session, SQLModel, create_engine

from app.config import settings

# Importing the models package registers every table on SQLModel.metadata.
import app.models  # noqa: F401


def _make_engine() -> Engine:
    connect_args: dict[str, object] = {}
    if settings.DATABASE_URL.startswith("sqlite"):
        # FastAPI serves requests from a threadpool, so the connection is used from
        # more than one thread. Safe here because each request gets its own Session.
        connect_args["check_same_thread"] = False
    return create_engine(
        settings.DATABASE_URL,
        echo=False,
        connect_args=connect_args,
    )


engine = _make_engine()


def create_db_and_tables() -> None:
    """Create any missing tables.

    No Alembic: for a two-day build, migrations cost more than they save. If a model
    changes, delete the SQLite file and re-run the seed script.
    """
    SQLModel.metadata.create_all(engine)


def get_session() -> Generator[Session, None, None]:
    """FastAPI dependency yielding a request-scoped session."""
    with Session(engine) as session:
        yield session
