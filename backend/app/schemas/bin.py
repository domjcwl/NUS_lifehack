"""Request and response models for bins and QR resolution."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import WasteType


class BinRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    type: WasteType
    latitude: float
    longitude: float
    address: str
    qr_code_id: str
    accepted_waste_types: list[str]
    opening_hours: str | None
    notes: str | None
    active: bool


class BinNearbyRead(BinRead):
    """A bin plus how far away it is. Only returned by the nearby search."""

    distance_m: float = Field(description="Straight-line distance in metres.")
    distance_label: str = Field(description="Ready to display, e.g. '450 m'.")
    walking_minutes: int = Field(
        description="Rough estimate at 5 km/h. Not a routing result."
    )


class QRBinRead(BaseModel):
    """What the page behind a scanned QR code needs in order to render itself."""

    bin: BinRead
    points_available: int = Field(
        description="Points a verified submission at this bin would award."
    )
    submit_path: str = Field(
        description="Where to POST the proof photo for this bin."
    )
    message: str = Field(description="Short line to show the user on the page.")
