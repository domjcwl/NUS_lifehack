"""Request and response models for recycling activities."""

from pydantic import BaseModel, ConfigDict, Field

from app.models.enums import MediaType, VerificationStatus, WasteType
from app.schemas.common import UTCDateTime


class ActivityRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: int
    group_id: int | None
    bin_id: int
    waste_type: WasteType
    media_url: str
    media_type: MediaType
    caption: str | None
    verification_status: VerificationStatus
    verification_score: float | None
    verification_note: str | None
    points_awarded: int
    created_at: UTCDateTime


class SubmissionResult(BaseModel):
    """What the scan page shows after a photo is submitted."""

    activity: ActivityRead
    points_awarded: int = Field(description="Points from this submission alone.")
    bonus_awarded: int = Field(
        default=0, description="Any one-off bonus, e.g. a first-submission reward."
    )
    user_total_points: int
    group_total_points: int | None = None
    message: str = Field(description="Line to show the user, already phrased for them.")
