from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel

from app.models.user import utcnow


class Group(SQLModel, table=True):
    __tablename__ = "groups"

    id: int | None = Field(default=None, primary_key=True)
    name: str = Field(index=True, max_length=100)
    creator_id: int = Field(foreign_key="users.id", index=True)
    # Short human-typable code. Far friendlier to demo than pasting a numeric id.
    invite_code: str = Field(index=True, unique=True, max_length=12)
    created_at: datetime = Field(default_factory=utcnow)


class GroupMember(SQLModel, table=True):
    __tablename__ = "group_members"
    __table_args__ = (UniqueConstraint("user_id", "group_id", name="uq_group_member"),)

    id: int | None = Field(default=None, primary_key=True)
    user_id: int = Field(foreign_key="users.id", index=True)
    group_id: int = Field(foreign_key="groups.id", index=True)
    joined_at: datetime = Field(default_factory=utcnow)
