"""The searchable corpus: curated chunks plus anything ingested from NEA documents.

Two tiers, one type, one interface. `retrieval.search()` scores them together and
neither the graph nor the API needs to know which tier an answer came from — only
whether it carries a source URL, which the response passes through so the frontend
can show a real reference.

The ingested file is READ FROM DISK, never fetched. `scripts/ingest.py` runs once,
on a machine with wifi, and commits its output. A demo that needs nea.gov.sg to be
reachable is a demo that fails in a basement.
"""

import json
import logging
from functools import lru_cache
from pathlib import Path

from app.config import settings
from app.rag.knowledge import KNOWLEDGE, Chunk

logger = logging.getLogger(__name__)

# Shown as the reference for a curated chunk, which has no single source document.
# Honest by construction: it does not claim to quote a specific NEA page.
CURATED_SOURCE_TITLE = "Floe knowledge base (from public NEA guidance)"

# The NEA page covering each curated topic, so every answer can offer a real
# reference the user can open and check.
#
# These are FURTHER READING, not the source of a quotation - the curated text is
# written from public guidance, not copied from these pages. `source_of` reports
# that distinction as `quoted`, and the API passes it through, so the frontend can
# label a verbatim NEA extract differently from our own summary. Presenting a
# paraphrase as a quotation would be a fabricated citation.
_NEA = "https://www.nea.gov.sg/our-services/waste-management"
_RECYCLABLES = (
    "NEA - Types of recyclables and recycling processes",
    f"{_NEA}/3r-programmes-and-resources/types-of-recyclables-and-recycling-processes",
)
_AT_HOME = (
    "NEA - Waste minimisation and recycling at home",
    f"{_NEA}/3r-programmes-and-resources/waste-minimisation-and-recycling/at-home",
)
TOPIC_SOURCES: dict[str, tuple[str, str]] = {
    "blue bin": (
        "NEA - National Recycling Programme",
        f"{_NEA}/3r-programmes-and-resources/national-recycling-programme",
    ),
    "e-waste": (
        "NEA - E-waste management",
        f"{_NEA}/3r-programmes-and-resources/e-waste-management",
    ),
    "paper": _RECYCLABLES,
    "plastic": _RECYCLABLES,
    "glass": _RECYCLABLES,
    "metal": _RECYCLABLES,
    "contamination": _AT_HOME,
    "textiles": _AT_HOME,
    "food": _AT_HOME,
    "process": ("NEA - Waste management overview", f"{_NEA}/overview"),
}


def _load_ingested(path: Path) -> list[Chunk]:
    """Chunks written by scripts/ingest.py. Absent or malformed is not an error.

    The service must start and answer with the curated tier alone — the ingested
    file is an enhancement, and a JSON typo at 3am must not take the endpoint down.
    """
    if not path.exists():
        logger.info("No ingested chunks at %s - using the curated tier only.", path)
        return []

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        logger.exception("Could not read %s - using the curated tier only.", path)
        return []

    chunks: list[Chunk] = []
    for entry in raw:
        try:
            chunks.append(
                Chunk(
                    id=entry["id"],
                    topic=entry.get("topic", "nea"),
                    text=entry["text"],
                    keywords=tuple(entry.get("keywords", ())),
                    source_url=entry.get("source_url", ""),
                    source_title=entry.get("source_title", ""),
                )
            )
        except (KeyError, TypeError):
            logger.warning("Skipping malformed ingested chunk: %r", entry)

    logger.info("Loaded %d ingested chunk(s) from %s", len(chunks), path)
    return chunks


@lru_cache(maxsize=1)
def corpus() -> tuple[Chunk, ...]:
    """Every searchable chunk, curated first.

    Order matters on ties: `retrieval.search` sorts by score alone and Python's sort
    is stable, so a curated chunk beats an ingested one at an equal score. That is
    the trust ordering we want — the curated text is written to read well quoted
    verbatim, which is exactly what the offline path does with it.
    """
    ingested = _load_ingested(Path(settings.CHUNKS_PATH))
    return tuple(KNOWLEDGE) + tuple(ingested)


def source_of(chunk: Chunk) -> tuple[str, str, bool]:
    """(title, url, quoted) for display.

    `quoted` is True only when the snippet is text extracted from that URL. A
    curated chunk gets the NEA page on its topic as further reading, with
    quoted=False, because its wording is ours and not NEA's.
    """
    if chunk.source_url:
        return (chunk.source_title or "NEA", chunk.source_url, True)
    if reference := TOPIC_SOURCES.get(chunk.topic):
        title, url = reference
        return (title, url, False)
    return (CURATED_SOURCE_TITLE, "", False)


def reset() -> None:
    """Drop the cached corpus. For tests, and after re-running the ingest script."""
    corpus.cache_clear()
