"""SQLModel tables.

Importing this package registers every table on SQLModel.metadata, which is what
create_db_and_tables() relies on. Export new models here.
"""

from app.models.activity import PointTransaction, RecyclingActivity
from app.models.bin import Bin
from app.models.enums import MediaType, PointReason, VerificationStatus, WasteType
from app.models.group import Group, GroupMember
from app.models.news import NewsArticle
from app.models.pet import Pet
from app.models.user import User, utcnow

__all__ = [
    "Bin",
    "Group",
    "GroupMember",
    "MediaType",
    "NewsArticle",
    "Pet",
    "PointReason",
    "PointTransaction",
    "RecyclingActivity",
    "User",
    "VerificationStatus",
    "WasteType",
    "utcnow",
]
