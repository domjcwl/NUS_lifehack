"""Geographic helpers.

Distance is computed here rather than by a maps API on purpose: nearby-bin search is
the first step of the demo and it must not depend on a network call or an API key.
Haversine is accurate to well under a metre at city scale, which is far better than
the precision of the bin coordinates themselves.
"""

from math import asin, cos, radians, sin, sqrt

EARTH_RADIUS_M = 6_371_000.0

# Metres per degree of latitude. Close enough to constant everywhere.
_METRES_PER_DEGREE_LAT = 111_320.0


def haversine_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Great-circle distance between two points, in metres."""
    phi1, phi2 = radians(lat1), radians(lat2)
    d_phi = radians(lat2 - lat1)
    d_lambda = radians(lon2 - lon1)

    a = sin(d_phi / 2) ** 2 + cos(phi1) * cos(phi2) * sin(d_lambda / 2) ** 2
    return 2 * EARTH_RADIUS_M * asin(sqrt(a))


def bounding_box(
    latitude: float, longitude: float, radius_m: float
) -> tuple[float, float, float, float]:
    """A lat/lon box that fully contains the radius.

    Used to narrow the query in SQL before the exact haversine runs in Python. The box
    is always a superset of the circle, so it never drops a bin that should match.

    Returns (min_lat, max_lat, min_lon, max_lon).
    """
    lat_delta = radius_m / _METRES_PER_DEGREE_LAT

    # A degree of longitude shrinks towards the poles. cos() approaches zero there,
    # so clamp it to keep the division finite.
    shrink = max(cos(radians(latitude)), 1e-6)
    lon_delta = radius_m / (_METRES_PER_DEGREE_LAT * shrink)

    return (
        max(latitude - lat_delta, -90.0),
        min(latitude + lat_delta, 90.0),
        longitude - lon_delta,
        longitude + lon_delta,
    )


def format_distance(metres: float) -> str:
    """Human-readable distance for the UI: '450 m', '1.2 km'."""
    if metres < 1000:
        return f"{round(metres)} m"
    return f"{metres / 1000:.1f} km"


def walking_minutes(metres: float) -> int:
    """Rough walking time at 5 km/h. A hint for the list view, not a routing result."""
    return max(1, round(metres / 1000 / 5 * 60))
