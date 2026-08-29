from sqlalchemy import JSON, Column
from sqlmodel import Field, SQLModel

from app.models.enums import WasteType


class Bin(SQLModel, table=True):
    __tablename__ = "bins"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(max_length=150)
    type: WasteType = Field(index=True)
    latitude: float = Field(index=True)
    longitude: float = Field(index=True)
    address: str = Field(max_length=300)
    # The value encoded in the physical QR sticker, resolved by GET /recycle/{qr_code_id}
    qr_code_id: str = Field(index=True, unique=True, max_length=64)
    # A bin may accept several streams, so this is a list rather than just `type`.
    accepted_waste_types: list[str] = Field(default_factory=list, sa_column=Column(JSON))
    opening_hours: str | None = Field(default=None, max_length=120)
    notes: str | None = Field(default=None, max_length=500)
    active: bool = Field(default=True, index=True)
