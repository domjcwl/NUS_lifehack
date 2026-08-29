"""Shared schema building blocks."""

from datetime import datetime
from typing import Annotated

from pydantic import PlainSerializer

from app.utils.time import as_utc

# Use this instead of a bare `datetime` in every response schema. It guarantees the
# JSON carries an explicit UTC offset, so clients render "3 minutes ago" correctly.
UTCDateTime = Annotated[
    datetime,
    PlainSerializer(
        lambda v: as_utc(v).isoformat().replace("+00:00", "Z"), return_type=str
    ),
]
