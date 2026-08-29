"""Turn a Singapore place name or postal code into coordinates.

Layered, most-trustworthy first:

1. **Postal code against the bin dataset.** Exact, instant, offline. The 13,004
   NEA points carry postal codes, so "521826" never needs the network.
2. **A web geocoder.** Nominatim (OpenStreetMap) by default — free, no key, and it
   knows landmarks no bin dataset will: "Raffles Hall", "Clementi Mall". OneMap is
   preferred when `ONEMAP_TOKEN` is set, since its Singapore coverage is better.
3. **Bin names, as an offline last resort.** Only when the network is unavailable,
   and only on whole-word matches.
4. **Nothing.** Every failure returns None and the caller asks for a postal code.
   A geocoder that is down costs a feature, never the endpoint.

Not OneMap by default, despite being the obvious Singapore choice: its search
endpoint now answers `{"error": "Authentication token missing..."}` for anonymous
callers, and its tokens expire every few days. A demo that dies when a token
lapses is worse than one built on a service needing no account.

The name-matching in layer 3 is deliberately strict. A naive substring match maps
"NUS" onto a bin called "Coralinus" and sends someone 15 km across the island —
that is a real bug this module had, and word boundaries are the fix.

Successful lookups are cached to `data/places.json`, which is committed, so a
place resolved once on wifi keeps resolving in a basement. Failures caused by the
network are NOT cached, or one flaky moment would poison a place permanently.
"""

import json
import logging
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

logger = logging.getLogger(__name__)

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search?{q}"
ONEMAP_URL = (
    "https://www.onemap.gov.sg/api/common/elastic/search"
    "?searchVal={q}&returnGeom=Y&getAddrDetails=Y&pageNum=1"
)
# Nominatim's usage policy requires a real identifying User-Agent and at most one
# request a second. The disk cache keeps us far under that in practice.
UA = "FloeRecyclingChatbot/1.0 (NUS LifeHack student project)"
_MIN_INTERVAL = 1.1

# Singapore's bounding box. A junk parse that somehow geocodes abroad must not
# send someone walking to a bin 300 km away.
SG_BOUNDS = (1.15, 1.50, 103.55, 104.10)  # lat_min, lat_max, lng_min, lng_max

POSTAL_RE = re.compile(r"^\d{6}$")


class GeocodeUnavailable(Exception):
    """The lookup could not complete. Distinct from 'no such place'."""


@dataclass(frozen=True)
class Place:
    name: str
    latitude: float
    longitude: float
    address: str = ""
    source: str = "cache"


_cache: dict[str, dict | None] | None = None
_lock = threading.Lock()
_last_call = 0.0


def _in_singapore(lat: float, lng: float) -> bool:
    lat_min, lat_max, lng_min, lng_max = SG_BOUNDS
    return lat_min <= lat <= lat_max and lng_min <= lng <= lng_max


# --- layer 1: postal codes, from the bin dataset ----------------------------


def _from_postal(query: str) -> Place | None:
    from app.tools import bins as bin_tool

    code = query.strip()
    if not POSTAL_RE.match(code):
        return None
    for b in bin_tool.all_bins():
        if b.postal == code:
            return Place(b.name, b.lat, b.lng, f"postal {b.postal}", "bins")
    return None


# --- layer 3: bin names, offline fallback only ------------------------------


def _from_bin_names(query: str) -> Place | None:
    """Whole-word name match, best candidate first.

    Scored rather than first-hit, because dataset order is arbitrary: an exact
    name beats a prefix, which beats a word appearing anywhere, and the shortest
    name wins ties as the most specific.
    """
    from app.tools import bins as bin_tool

    needle = re.sub(r"\s+", " ", query.strip().lower())
    if len(needle) < 3:
        return None
    word = re.compile(rf"\b{re.escape(needle)}\b")

    best: tuple[int, int, object] | None = None
    for b in bin_tool.all_bins():
        name = b.name.lower()
        if name == needle:
            score = 3
        elif name.startswith(needle):
            score = 2
        elif word.search(name):
            score = 1
        else:
            continue
        candidate = (score, -len(b.name), b)
        if best is None or candidate[:2] > best[:2]:
            best = candidate

    if best is None:
        return None
    b = best[2]
    return Place(b.name, b.lat, b.lng, f"postal {b.postal}", "bins")


# --- layer 2: a web geocoder ------------------------------------------------


def _get_json(url: str) -> dict | list:
    global _last_call
    with _lock:
        wait = _MIN_INTERVAL - (time.monotonic() - _last_call)
        if wait > 0:
            time.sleep(wait)
        _last_call = time.monotonic()

    request = urllib.request.Request(url, headers={"User-Agent": UA})
    try:
        with urllib.request.urlopen(request, timeout=settings.GEOCODE_TIMEOUT_SECONDS) as r:
            return json.loads(r.read().decode("utf-8"))
    except (urllib.error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
        raise GeocodeUnavailable(type(exc).__name__) from exc


def _from_onemap(query: str) -> Place | None:
    token = settings.ONEMAP_TOKEN.strip()
    url = ONEMAP_URL.format(q=urllib.parse.quote(query))
    request_url = f"{url}&token={urllib.parse.quote(token)}" if token else url
    payload = _get_json(request_url)
    if isinstance(payload, dict) and payload.get("error"):
        # Missing or expired token. Unavailable, not "no such place", so the
        # caller falls through to Nominatim instead of concluding it exists not.
        raise GeocodeUnavailable(str(payload["error"])[:60])
    for result in payload.get("results", []) if isinstance(payload, dict) else []:
        try:
            lat, lng = float(result["LATITUDE"]), float(result["LONGITUDE"])
        except (KeyError, TypeError, ValueError):
            continue
        if _in_singapore(lat, lng):
            return Place(
                result.get("SEARCHVAL", query).title(),
                lat,
                lng,
                result.get("ADDRESS", ""),
                "onemap",
            )
    return None


def _from_nominatim(query: str) -> Place | None:
    params = urllib.parse.urlencode(
        {
            "q": f"{query}, Singapore",
            "format": "json",
            "limit": "1",
            "countrycodes": "sg",
        }
    )
    payload = _get_json(NOMINATIM_URL.format(q=params))
    for result in payload if isinstance(payload, list) else []:
        try:
            lat, lng = float(result["lat"]), float(result["lon"])
        except (KeyError, TypeError, ValueError):
            continue
        if _in_singapore(lat, lng):
            display = result.get("display_name", query)
            return Place(display.split(",")[0].strip() or query, lat, lng, display, "osm")
    return None


# --- the disk cache ---------------------------------------------------------


def _cache_path() -> Path:
    return Path(settings.PLACES_PATH)


def _load_cache() -> dict[str, dict | None]:
    global _cache
    if _cache is not None:
        return _cache
    path = _cache_path()
    try:
        _cache = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    except (json.JSONDecodeError, OSError):
        logger.exception("Could not read %s - starting with an empty place cache.", path)
        _cache = {}
    return _cache


def _save_cache() -> None:
    """Best-effort persist. A read-only disk must not break a lookup that worked."""
    try:
        path = _cache_path()
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(
            json.dumps(_load_cache(), indent=1, ensure_ascii=False, sort_keys=True),
            encoding="utf-8",
        )
    except OSError:
        logger.warning("Could not write the place cache", exc_info=True)


def _key(query: str) -> str:
    return re.sub(r"\s+", " ", query.strip().lower())


def _remember(key: str, place: Place | None) -> None:
    cache = _load_cache()
    with _lock:
        cache[key] = (
            None
            if place is None
            else {
                "name": place.name,
                "latitude": place.latitude,
                "longitude": place.longitude,
                "address": place.address,
                "source": place.source,
            }
        )
    _save_cache()


# --- the entry point --------------------------------------------------------


def geocode(query: str) -> Place | None:
    """Coordinates for a Singapore place name or postal code, or None."""
    if not query or not query.strip():
        return None

    key = _key(query)
    cache = _load_cache()
    if key in cache:
        hit = cache[key]
        if hit is None:
            return None  # a cached "no such place" - do not re-ask the network
        return Place(
            hit["name"],
            hit["latitude"],
            hit["longitude"],
            hit.get("address", ""),
            hit.get("source", "cache"),
        )

    if postal := _from_postal(query):
        logger.info("Resolved postal %r -> %s", query, postal.name)
        _remember(key, postal)
        return postal

    unavailable = False
    if settings.GEOCODE_ENABLED:
        providers = []
        if settings.ONEMAP_TOKEN.strip():
            providers.append(_from_onemap)
        providers.append(_from_nominatim)

        for provider in providers:
            try:
                place = provider(query)
            except GeocodeUnavailable as exc:
                logger.warning("%s unavailable for %r (%s)", provider.__name__, query, exc)
                unavailable = True
                continue
            if place:
                logger.info(
                    "Geocoded %r -> %s (%s, %s) via %s",
                    query, place.name, place.latitude, place.longitude, place.source,
                )
                _remember(key, place)
                return place

    if unavailable or not settings.GEOCODE_ENABLED:
        # Offline. Try bin names rather than give up, but do NOT cache the result:
        # it is a weaker answer than the geocoder would have given, and caching it
        # would keep us on the fallback long after the network comes back.
        if fallback := _from_bin_names(query):
            logger.info("Resolved %r from bin names (offline) -> %s", query, fallback.name)
            return fallback
        return None

    _remember(key, None)
    return None


def cached_count() -> int:
    """How many lookups are cached. Surfaced on /health."""
    return len(_load_cache())


def reset() -> None:
    """Drop the in-memory cache. For tests."""
    global _cache
    _cache = None
