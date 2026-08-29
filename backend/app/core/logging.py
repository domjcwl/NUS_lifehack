"""Logging setup.

Never log passwords, password hashes, tokens, API keys or raw request bodies.
Log the event and the identifiers needed to trace it, nothing more.
"""

import logging
import sys

from app.config import settings

_CONFIGURED = False


def setup_logging() -> None:
    global _CONFIGURED
    if _CONFIGURED:
        return

    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(
        logging.Formatter(
            "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s",
            datefmt="%H:%M:%S",
        )
    )

    root = logging.getLogger()
    root.handlers = [handler]
    root.setLevel(logging.DEBUG if settings.DEBUG else logging.INFO)

    # These are chatty at DEBUG and drown out our own lines during a demo. The HTTP
    # clients also log full request bodies, which is noise at best.
    for noisy in (
        "sqlalchemy.engine",
        "anthropic",
        "httpx",
        "httpx2",
        "httpcore",
        "httpcore2",
        "urllib3",
    ):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _CONFIGURED = True


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)
