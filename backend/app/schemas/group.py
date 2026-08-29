"""Request and response models for groups."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.models.enums import VerificationStatus, WasteType
from app.schemas.common import UTCDateTime


class GroupCreate(BaseModel):
    name: str = Field(
        min_length=2,
        max_length=100,
        description="What the group is called.",
        examples=["Kent Ridge Recyclers"],
    )

    @field_validator("name")
    @classmethod
    def not_blank(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("Group name cannot be blank")
        return cleaned


class GroupJoinByCode(BaseModel):
    invite_code: str = Field(
        min_length=4,
        max_length=12,
        description="The code shared by a member. Case and dashes do not matter.",
        examples=["7KPQ4M"],
    )


class GroupRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    creator_id: int
    invite_code: str
    created_at: UTCDateTime


class GroupDetail(GroupRead):
    member_count: int
    total_points: int
    activity_count: int


class GroupMemberRead(BaseModel):
    user_id: int
    username: str
    display_name: str | None
    joined_at: UTCDateTime
    points: int = Field(description="Points this member has earned for this group.")
    activity_count: int


class LeaderboardEntry(BaseModel):
    rank: int
    user_id: int
    username: str
    display_name: str | None
    points: int
    activity_count: int


class ActivityFeedItem(BaseModel):
    """One line of the group feed, with the sentence already composed.

    The backend writes the sentence so every client renders it identically, and so the
    wording can be tuned in one place.
    """

    activity_id: int
    user_id: int
    username: str
    display_name: str | None
    bin_id: int
    bin_name: str
    waste_type: WasteType
    points_awarded: int
    caption: str | None
    media_url: str
    verification_status: VerificationStatus
    created_at: UTCDateTime
    text: str = Field(examples=["Dominic recycled e-waste 🔌 +20 points"])
