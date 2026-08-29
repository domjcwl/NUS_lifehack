from datetime import datetime

from sqlmodel import Field, SQLModel

from app.models.user import utcnow


class Pet(SQLModel, table=True):
    """One pet per group.

    Group-owned on purpose: neglect costs your friends and not just you, which is the
    social pressure meant to keep the habit alive past the first week.
    """

    __tablename__ = "pets"

    id: int | None = Field(default=None, primary_key=True)
    group_id: int = Field(foreign_key="groups.id", index=True, unique=True)
    name: str = Field(max_length=50)
    species: str = Field(default="otter", max_length=50)
    level: int = Field(default=1)
    xp: int = Field(default=0)
    health: float = Field(default=100.0)
    hunger: float = Field(default=0.0)  # 0 = full, 100 = starving
    # Hunger and health are decayed lazily from this timestamp on read, not by a cron job.
    updated_at: datetime = Field(default_factory=utcnow)
    created_at: datetime = Field(default_factory=utcnow)
