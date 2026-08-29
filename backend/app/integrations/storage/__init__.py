"""Storage backend selection."""

from functools import lru_cache

from app.config import settings
from app.core.logging import get_logger
from app.integrations.storage.base import StorageService
from app.integrations.storage.local import LocalStorage

logger = get_logger(__name__)

__all__ = ["StorageService", "LocalStorage", "get_storage"]


@lru_cache
def get_storage() -> StorageService:
    """The configured storage backend.

    Only `local` exists today. An S3 backend implementing the same Protocol would be
    selected here, and nothing else in the app would change.
    """
    if settings.STORAGE_BACKEND != "local":
        logger.warning(
            "STORAGE_BACKEND=%r is not implemented; falling back to local disk.",
            settings.STORAGE_BACKEND,
        )
    return LocalStorage(settings.STORAGE_DIR)
