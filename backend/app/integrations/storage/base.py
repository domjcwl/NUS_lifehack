"""Storage interface.

Routes and services depend on this Protocol, never on a concrete backend, so swapping
local disk for S3 is a change to one factory function.
"""

from typing import Protocol


class StorageService(Protocol):
    """Somewhere to put an uploaded file and get a URL back."""

    def save(self, data: bytes, filename: str, content_type: str) -> str:
        """Persist the bytes and return a URL the frontend can load."""
        ...

    def delete(self, url: str) -> bool:
        """Remove a stored object. Returns False if it was not there."""
        ...
