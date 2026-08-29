from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.enums import MediaType, VerificationStatus, WasteType
from app.models.user import utcnow


class RecyclingActivity(SQLModel, table=True):
    """One proven act of recycling.

    This table is the measurement instrument: every claim the pitch makes about
    behaviour change is a query over these rows.
    """

    __tablename__ = "recycling_activities"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    group_id: int | None = Field(default=None, foreign_key="groups.id", index=True)
    bin_id: int = Field(foreign_key="bins.id", index=True)
    waste_type: WasteType = Field(index=True)

    media_url: str = Field(max_length=500)
    media_type: MediaType
    # Perceptual hash of the image, for duplicate-upload detection. Null for video.
    media_hash: str | None = Field(default=None, index=True, max_length=64)
    caption: str | None = Field(default=None, max_length=280)

    verification_status: VerificationStatus = Field(
        default=VerificationStatus.PENDING, index=True
    )
    verification_score: float | None = Field(default=None)
    verification_note: str | None = Field(default=None, max_length=500)

    points_awarded: int = Field(default=0)
    created_at: datetime = Field(default_factory=utcnow, index=True)


class PointTransaction(SQLModel, table=True):
    """Append-only points ledger. Never mutate a row here, write a compensating one."""

    __tablename__ = "point_transactions"

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    group_id: int | None = Field(default=None, foreign_key="groups.id", index=True)
    activity_id: int | None = Field(
        default=None, foreign_key="recycling_activities.id", index=True
    )
    points: int
    reason: str = Field(max_length=64)
    created_at: datetime = Field(default_factory=utcnow, index=True)
