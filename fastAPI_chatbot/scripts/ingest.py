"""Ingest NEA guidance into searchable chunks.

    python scripts/ingest.py

Writes `data/chunks.json` (the chunks the retriever searches) and
`data/sources.json` (what was fetched and when, for the README's Acknowledgements).

RUN THIS ONCE, WITH WIFI, AND COMMIT THE OUTPUT. The service reads the committed
JSON and never fetches anything at request time — a demo that needs nea.gov.sg to
be reachable is a demo that fails in a basement.

Deliberately dependency-light: urllib from the standard library, exactly as
scripts/fetch-bins.py at the repo root already does, plus pypdf only if a source
turns out to be a PDF. There is no HTML parser here because NEA's content pages
are plain enough that tag-stripping plus the boilerplate filter below does the job,
and adding beautifulsoup for one script is not a trade worth making this week.
"""

import html
import json
import re
import sys
import urllib.error
import urllib.request
from collections import Counter
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_CHUNKS = ROOT / "data" / "chunks.json"
OUT_SOURCES = ROOT / "data" / "sources.json"

# Verified reachable 29 Aug 2026. Each is a page a judge could open and check.
SOURCES: list[tuple[str, str]] = [
    (
        "NEA — Types of recyclables and recycling processes",
        "https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/types-of-recyclables-and-recycling-processes",
    ),
    (
        "NEA — National Recycling Programme",
        "https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/national-recycling-programme",
    ),
    (
        "NEA — E-waste management",
        "https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/e-waste-management",
    ),
    (
        "NEA — Where to recycle e-waste",
        "https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/e-waste-management/where-to-recycle-e-waste",
    ),
    (
        "NEA — Waste minimisation and recycling at home",
        "https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/waste-minimisation-and-recycling/at-home",
    ),
    (
        "NEA — Recycling collection points",
        "https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/recycling-collection-points",
    ),
    (
        "NEA — Waste management overview",
        "https://www.nea.gov.sg/our-services/waste-management/overview",
    ),
    (
        "NEA — Semakau Landfill",
        "https://www.nea.gov.sg/our-services/waste-management/waste-management-infrastructure/semakau-landfill",
    ),
]

# A chunk should be one self-contained idea: long enough to answer a question,
# short enough that quoting it verbatim on the offline path is not a wall of text.
MIN_WORDS = 45
TARGET_WORDS = 170

UA = "Mozilla/5.0 (compatible; FloeChatbot/1.0; NUS LifeHack project)"

_SCRIPTS = re.compile(r"<(script|style|noscript)[^>]*>.*?</\1>", re.S | re.I)
_TAGS = re.compile(r"<[^>]+>")
_BLOCK_END = re.compile(r"</(p|div|li|h[1-6]|tr|section)>", re.I)
_WS = re.compile(r"[ \t\xa0]+")


def fetch(url: str) -> bytes | None:
    request = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.read()
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        print(f"  ! could not fetch ({exc}) - skipping", file=sys.stderr)
        return None


def to_paragraphs(payload: bytes, url: str) -> list[str]:
    """Readable paragraphs from an HTML page or a PDF."""
    if url.lower().endswith(".pdf") or payload[:5] == b"%PDF-":
        try:
            import io

            from pypdf import PdfReader
        except ImportError:
            print("  ! pypdf not installed, skipping PDF", file=sys.stderr)
            return []
        reader = PdfReader(io.BytesIO(payload))
        text = "\n\n".join(page.extract_text() or "" for page in reader.pages)
    else:
        text = payload.decode("utf-8", errors="replace")
        text = _SCRIPTS.sub(" ", text)
        # Turn block ends into paragraph breaks before dropping the tags, or the
        # whole page collapses into one run-on line.
        text = _BLOCK_END.sub("\n\n", text)
        text = _TAGS.sub(" ", text)
        text = html.unescape(text)

    paragraphs = []
    for raw in text.split("\n"):
        cleaned = _WS.sub(" ", raw).strip()
        if cleaned:
            paragraphs.append(cleaned)
    return paragraphs


# Site chrome that reads like prose and so survives every structural filter. The
# cross-page dedup below misses these because they appear on ONE page, not many.
_JUNK = (
    "outdated browser",
    "upgrade your browser",
    "enable javascript",
    "this site uses cookies",
    "skip to main content",
    "was this page useful",
    "rate this page",
    "government agency website",
    "look for a lock",
)


def is_prose(paragraph: str) -> bool:
    """Filter out nav labels, breadcrumbs, button text and site chrome.

    Real guidance is a sentence: it has some length and it ends like one.
    """
    lowered = paragraph.lower()
    if any(j in lowered for j in _JUNK):
        return False
    if len(paragraph) < 60:
        return False
    words = paragraph.split()
    if len(words) < 10:
        return False
    # Navigation is title-case fragments; prose contains lowercase function words.
    return sum(1 for w in words if w.islower()) >= len(words) * 0.4


def chunk_paragraphs(paragraphs: list[str]) -> list[str]:
    """Group paragraphs into chunks of roughly TARGET_WORDS."""
    chunks: list[str] = []
    buffer: list[str] = []
    count = 0

    for paragraph in paragraphs:
        words = len(paragraph.split())
        if count and count + words > TARGET_WORDS:
            chunks.append(" ".join(buffer))
            buffer, count = [], 0
        buffer.append(paragraph)
        count += words

    if buffer:
        chunks.append(" ".join(buffer))
    return [c for c in chunks if len(c.split()) >= MIN_WORDS]


def slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower().replace("nea", "nea", 1)).strip("-")


def main() -> int:
    fetched: list[tuple[str, str, list[str]]] = []

    for title, url in SOURCES:
        print(f"- {title}")
        payload = fetch(url)
        if payload is None:
            continue
        paragraphs = [p for p in to_paragraphs(payload, url) if is_prose(p)]
        print(f"  {len(payload) // 1024} KB -> {len(paragraphs)} prose paragraph(s)")
        fetched.append((title, url, paragraphs))

    if not fetched:
        print("\nNothing fetched. data/chunks.json left unchanged.", file=sys.stderr)
        return 1

    # Site chrome repeats on every page. Anything appearing on more than one page
    # is navigation, a cookie banner or a footer - never the guidance we want.
    seen = Counter(p for _t, _u, paragraphs in fetched for p in set(paragraphs))
    boilerplate = {p for p, n in seen.items() if n > 1}
    print(f"\nDropping {len(boilerplate)} paragraph(s) repeated across pages.")

    chunks: list[dict] = []
    sources: list[dict] = []
    today = date.today().isoformat()

    for title, url, paragraphs in fetched:
        kept = [p for p in paragraphs if p not in boilerplate]
        page_chunks = chunk_paragraphs(kept)
        base = slug(title)
        for i, text in enumerate(page_chunks, 1):
            chunks.append(
                {
                    "id": f"{base}-{i}",
                    "topic": "nea",
                    "text": text,
                    # No declared keywords: these are quoted, not hand-tuned, and
                    # inventing search terms for them would be guesswork. BM25 over
                    # the text still scores them.
                    "keywords": [],
                    "source_url": url,
                    "source_title": title,
                }
            )
        sources.append(
            {"title": title, "url": url, "fetched_at": today, "chunks": len(page_chunks)}
        )
        print(f"  {title}: {len(page_chunks)} chunk(s)")

    OUT_CHUNKS.parent.mkdir(parents=True, exist_ok=True)
    OUT_CHUNKS.write_text(json.dumps(chunks, indent=1, ensure_ascii=False), encoding="utf-8")
    OUT_SOURCES.write_text(json.dumps(sources, indent=1, ensure_ascii=False), encoding="utf-8")

    print(f"\nWrote {len(chunks)} chunks to {OUT_CHUNKS.relative_to(ROOT)}")
    print(f"Wrote {len(sources)} sources to {OUT_SOURCES.relative_to(ROOT)}")
    print("\nCommit both. Add the sources to the README's Acknowledgements.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
