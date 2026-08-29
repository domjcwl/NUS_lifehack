"""Bin queries.

Only the non-trivial ones live here. Simple lookups by primary key go straight through
the session in the service.
"""

from sqlmodel import Session, select

from app.models import Bin
from app.models.enums import WasteType
from app.utils.geo import bounding_box, haversine_m


def get_by_qr_code(session: Session, qr_code_id: str) -> Bin | None:
    statement = select(Bin).where(Bin.qr_code_id == qr_code_id.strip())
    return session.exec(statement).first()


def find_nearby(
    session: Session,
    latitude: float,
    longitude: float,
    radius_m: float,
    waste_type: WasteType | None = None,
    limit: int = 20,
    include_inactive: bool = False,
) -> list[tuple[Bin, float]]:
    """Bins within `radius_m`, nearest first, each paired with its distance in metres.

    Two stages: a bounding-box filter in SQL that uses the lat/lon indexes and discards
    most rows cheaply, then an exact haversine in Python over what survives. The box is
    always a superset of the circle, so nothing that should match is dropped.
    """
    min_lat, max_lat, min_lon, max_lon = bounding_box(latitude, longitude, radius_m)

    statement = select(Bin).where(
        Bin.latitude >= min_lat,
        Bin.latitude <= max_lat,
        Bin.longitude >= min_lon,
        Bin.longitude <= max_lon,
    )
    if not include_inactive:
        statement = statement.where(Bin.active == True)  # noqa: E712

    candidates = session.exec(statement).all()

    results: list[tuple[Bin, float]] = []
    for candidate in candidates:
        # A bin matches the filter if the requested stream is one it accepts. Checked
        # in Python because `accepted_waste_types` is a JSON column and portable
        # containment queries across SQLite and Postgres are not worth the trouble here.
        if waste_type is not None and not _accepts(candidate, waste_type):
            continue

        distance = haversine_m(
            latitude, longitude, candidate.latitude, candidate.longitude
        )
        if distance <= radius_m:
            results.append((candidate, distance))

    results.sort(key=lambda pair: pair[1])
    return results[:limit]


def _accepts(bin_: Bin, waste_type: WasteType) -> bool:
    accepted = bin_.accepted_waste_types or []
    return waste_type.value in accepted or bin_.type == waste_type
