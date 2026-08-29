"""Bin lookup and QR resolution business logic."""

from sqlmodel import Session

from app.config import settings
from app.core.errors import NotFoundError
from app.core.logging import get_logger
from app.models import Bin
from app.models.enums import WasteType
from app.repositories import bin_repository
from app.schemas.bin import BinNearbyRead, BinRead, QRBinRead
from app.utils.geo import format_distance, walking_minutes

logger = get_logger(__name__)


def points_for(waste_type: WasteType) -> int:
    """Points a verified submission of this stream is worth. Configured, never literal."""
    if waste_type == WasteType.E_WASTE:
        return settings.POINTS_EWASTE
    return settings.POINTS_RECYCLING


def get_bin(session: Session, bin_id: int) -> Bin:
    found = session.get(Bin, bin_id)
    if found is None:
        raise NotFoundError(f"No bin with id {bin_id}")
    return found


def find_nearby(
    session: Session,
    latitude: float,
    longitude: float,
    radius_m: int,
    waste_type: WasteType | None,
    limit: int,
) -> list[BinNearbyRead]:
    """Active bins within the radius, nearest first. An empty list is a valid answer."""
    matches = bin_repository.find_nearby(
        session,
        latitude=latitude,
        longitude=longitude,
        radius_m=radius_m,
        waste_type=waste_type,
        limit=limit,
    )

    logger.info(
        "Nearby search at (%.4f, %.4f) r=%dm type=%s -> %d bins",
        latitude,
        longitude,
        radius_m,
        waste_type.value if waste_type else "any",
        len(matches),
    )

    return [
        BinNearbyRead(
            **BinRead.model_validate(found).model_dump(),
            distance_m=round(distance, 1),
            distance_label=format_distance(distance),
            walking_minutes=walking_minutes(distance),
        )
        for found, distance in matches
    ]


def resolve_qr_code(session: Session, qr_code_id: str) -> QRBinRead:
    """Turn a scanned QR code into everything its page needs.

    Unknown and out-of-service codes are both 404, with different messages so a
    teammate debugging at the bin can tell which happened.
    """
    found = bin_repository.get_by_qr_code(session, qr_code_id)

    if found is None:
        logger.info("QR scan rejected: unknown code %r", qr_code_id)
        raise NotFoundError(
            f"QR code {qr_code_id!r} is not recognised. Check the sticker, or browse "
            "GET /bins/nearby to find a bin."
        )

    if not found.active:
        logger.info("QR scan rejected: bin %s is inactive", found.id)
        raise NotFoundError(
            f"{found.name} is currently out of service. Try another bin nearby."
        )

    points = points_for(found.type)
    label = "e-waste" if found.type == WasteType.E_WASTE else "recycling"

    return QRBinRead(
        bin=BinRead.model_validate(found),
        points_available=points,
        submit_path=f"/recycle/{found.qr_code_id}/submit",
        message=f"You are at {found.name}. Submit a photo of your {label} to earn {points} points.",
    )
