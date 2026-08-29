"""Time helpers.

SQLite has no timezone-aware column type, so a datetime written as UTC-aware comes back
naive. Everything the app writes is UTC, so the rule is: a naive datetime read from the
database is UTC, and `as_utc` is what re-attaches that fact.

Without this, timestamps serialise with no offset and a browser reads them as local
time, which in Singapore puts every activity eight hours in the past.
"""

from datetime import datetime, timezone


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def as_utc(value: datetime) -> datetime:
    """Attach UTC to a naive datetime; convert an aware one to UTC."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def hours_between(earlier: datetime, later: datetime) -> float:
    """Elapsed hours, safe across the naive/aware boundary. Never negative."""
    delta = as_utc(later) - as_utc(earlier)
    return max(delta.total_seconds() / 3600.0, 0.0)
