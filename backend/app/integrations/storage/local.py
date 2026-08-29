"""Local-disk storage.

Files land in `STORAGE_DIR` and are served by the `/media` static mount in `main.py`.
Good enough for a hackathon, and the S3 replacement only has to satisfy the same
Protocol.
"""

import uuid
from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)

# Extension chosen from the declared content type rather than the uploaded filename,
# which is attacker-controlled and may contain path separators or a misleading suffix.
_EXTENSIONS = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/heic": ".heic",
    "video/mp4": ".mp4",
    "video/quicktime": ".mov",
    "video/webm": ".webm",
}


class LocalStorage:
    def __init__(self, directory: str, url_prefix: str = "/media") -> None:
        self.directory = Path(directory)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.url_prefix = url_prefix.rstrip("/")

    def save(self, data: bytes, filename: str, content_type: str) -> str:
        # A random name: never trust the client's filename, and this also stops two
        # users overwriting each other.
        extension = _EXTENSIONS.get(content_type, "")
        stored_name = f"{uuid.uuid4().hex}{extension}"

        destination = self.directory / stored_name
        destination.write_bytes(data)

        logger.info("Stored %s (%d bytes) as %s", content_type, len(data), stored_name)
        return f"{self.url_prefix}/{stored_name}"

    def delete(self, url: str) -> bool:
        name = url.rsplit("/", 1)[-1]
        target = self.directory / name

        # Guard against a crafted url like "/media/../../app/main.py".
        if target.resolve().parent != self.directory.resolve():
            logger.warning("Refused to delete outside the storage directory: %s", url)
            return False

        if not target.exists():
            return False
        target.unlink()
        return True
