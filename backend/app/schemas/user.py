"""Request and response models for users."""

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

from app.schemas.common import UTCDateTime


class UserCreate(BaseModel):
    """Creating a user needs a username. Everything else is optional."""

    username: str = Field(
        min_length=3,
        max_length=50,
        description="Unique handle, 3-50 characters. Letters, digits, _ . - only.",
        examples=["your-username"],
    )
    email: EmailStr | None = Field(
        default=None,
        description="Optional. There is no login, so nothing depends on it.",
        examples=[None],
    )
    display_name: str | None = Field(
        default=None,
        max_length=100,
        description="Optional friendly name shown in the group activity feed.",
        examples=[None],
    )

    @field_validator("username")
    @classmethod
    def username_charset(cls, v: str) -> str:
        cleaned = v.strip()
        if not all(c.isalnum() or c in "_.-" for c in cleaned):
            raise ValueError("Username may only contain letters, digits, _ . and -")
        return cleaned


class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    username: str
    email: str | None
    display_name: str | None
    created_at: UTCDateTime
