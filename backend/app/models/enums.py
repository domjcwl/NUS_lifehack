"""Shared enumerations. String-valued so they read well in JSON and in the database."""

from enum import StrEnum


class WasteType(StrEnum):
    RECYCLING = "recycling"
    E_WASTE = "e_waste"


class MediaType(StrEnum):
    IMAGE = "image"
    VIDEO = "video"


class VerificationStatus(StrEnum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class PointReason(StrEnum):
    RECYCLING_ACTIVITY = "recycling_activity"
    FIRST_SUBMISSION_BONUS = "first_submission_bonus"
    PET_FEED = "pet_feed"
    ADJUSTMENT = "adjustment"
