"""Nearest-bin lookup over the shared NEA dataset.

13,004 real collection points fetched from data.gov.sg by `scripts/fetch-bins.py`
at the repo root — 12,291 blue recycling bins and 713 e-waste points. The file is
READ from web/data/bins.json, never copied: two copies drift, and the one you demo
will be the stale one.

No spatial index. A brute-force haversine over 13k rows is a few milliseconds, and
an index would be one more thing to keep correct for no measurable gain. No Google
Places, no OneMap, no key, and it works with the wifi off.
"""

import json
import logging
import math
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import Literal

from app.config import settings

logger = logging.getLogger(__name__)

BinKind = Literal["recycling", "ewaste"]

# Opens the phone's native maps app with walking directions from wherever the user
# is standing. A real directions API would return a polyline we have nowhere to draw.
DIRECTIONS_URL = "https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"


@dataclass(frozen=True)
class Bin:
    name: str
    postal: str
    kind: BinKind
    streams: tuple[str, ...]
    lat: float
    lng: float


@dataclass(frozen=True)
class NearbyBin:
    bin: Bin
    metres: int

    @property
    def directions_url(self) -> str:
        return DIRECTIONS_URL.format(lat=self.bin.lat, lng=self.bin.lng)


@lru_cache(maxsize=1)
def _bins() -> tuple[Bin, ...]:
    """The dataset, loaded once per process.

    A missing file is logged and returns nothing rather than raising: the chatbot
    still answers disposal questions without it, and losing the bin finder should
    not take down /chat.
    """
    path = Path(settings.BINS_PATH)
    if not path.exists():
        logger.error("Bin dataset not found at %s - location answers disabled.", path)
        return ()

    try:
        raw = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        logger.exception("Could not read %s - location answers disabled.", path)
        return ()

    # Compact keys, as written by scripts/build-bins.py: n=name, p=postal, t=type,
    # s=streams, y=lat, x=lng.
    loaded = tuple(
        Bin(
            name=r["n"],
            postal=r["p"],
            kind=r["t"],
            streams=tuple(r.get("s", ())),
            lat=r["y"],
            lng=r["x"],
        )
        for r in raw
    )
    logger.info("Loaded %d bins from %s", len(loaded), path)
    return loaded


def metres_between(a_lat: float, a_lng: float, b_lat: float, b_lng: float) -> int:
    """Haversine, in metres. Mirrors metresBetween() in web/src/lib/bins.ts."""
    radius = 6_371_000
    d_lat = math.radians(b_lat - a_lat)
    d_lng = math.radians(b_lng - a_lng)
    h = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(a_lat))
        * math.cos(math.radians(b_lat))
        * math.sin(d_lng / 2) ** 2
    )
    return round(2 * radius * math.asin(math.sqrt(h)))


def find_bins(
    lat: float, lng: float, kind: BinKind | None = None, limit: int = 3
) -> list[NearbyBin]:
    """The nearest bins of a kind, closest first.

    `kind` of None searches both, which is right for a vague "where do I recycle
    this" where the item was never identified.
    """
    candidates = [b for b in _bins() if kind is None or b.kind == kind]
    ranked = sorted(
        (NearbyBin(b, metres_between(lat, lng, b.lat, b.lng)) for b in candidates),
        key=lambda n: n.metres,
    )
    return ranked[:limit]


def all_bins() -> tuple[Bin, ...]:
    """Every loaded bin. Used by the geocoder to resolve postal codes offline."""
    return _bins()


def count() -> int:
    """How many bins loaded. Surfaced on /health to diagnose a bad BINS_PATH."""
    return len(_bins())


def reset() -> None:
    """Drop the cached dataset. For tests."""
    _bins.cache_clear()
