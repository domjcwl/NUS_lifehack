from datetime import datetime

from sqlmodel import Field, SQLModel

# Re-exported so every model can do `from app.models.user import utcnow`.
from app.utils.time import utcnow

__all__ = ["User", "utcnow"]


class User(SQLModel, table=True):
    __tablename__ = "users"

    id: int | None = Field(default=None, primary_key=True)
    username: str = Field(index=True, unique=True, max_length=50)
    # Optional: there is no login, so nothing depends on an email being present.
    # Still unique when supplied, so it stays usable if auth is turned back on.
    email: str | None = Field(default=None, index=True, unique=True, max_length=255)
    display_name: str | None = Field(default=None, max_length=100)
    created_at: datetime = Field(default_factory=utcnow, index=True)
