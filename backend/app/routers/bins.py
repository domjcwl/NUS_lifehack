"""Bin discovery routes."""

from fastapi import APIRouter, Query

from app.core.deps import SessionDep
from app.models.enums import WasteType
from app.schemas.bin import BinNearbyRead, BinRead
from app.services import bin_service

router = APIRouter(prefix="/bins", tags=["bins"])


@router.get(
    "/nearby",
    response_model=list[BinNearbyRead],
    summary="Find bins near a location",
    description=(
        "Active bins within `radius` metres, nearest first. Distance is computed "
        "locally, so this needs no API key and works offline.\n\n"
        "`type` filters by the stream a bin accepts - a bin that takes both appears "
        "under either. An empty list means nothing matched, which is not an error.\n\n"
        "Try `latitude=1.2966&longitude=103.7729` (NUS Central Library)."
    ),
)
def nearby(
    session: SessionDep,
    latitude: float = Query(
        ge=-90, le=90, description="Your latitude.", examples=[1.2966]
    ),
    longitude: float = Query(
        ge=-180, le=180, description="Your longitude.", examples=[103.7729]
    ),
    radius: int = Query(
        default=2000, ge=1, le=50_000, description="Search radius in metres."
    ),
    type: WasteType | None = Query(
        default=None, description="Filter to bins accepting this stream."
    ),
    limit: int = Query(default=20, ge=1, le=100),
) -> list[BinNearbyRead]:
    return bin_service.find_nearby(
        session,
        latitude=latitude,
        longitude=longitude,
        radius_m=radius,
        waste_type=type,
        limit=limit,
    )


@router.get(
    "/{bin_id}",
    response_model=BinRead,
    summary="Get one bin",
    responses={404: {"description": "No bin with that id"}},
)
def get_bin(bin_id: int, session: SessionDep) -> BinRead:
    return BinRead.model_validate(bin_service.get_bin(session, bin_id))
