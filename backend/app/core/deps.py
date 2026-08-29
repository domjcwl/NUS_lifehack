"""Shared FastAPI dependencies.

**Authentication is deliberately off.** Team decision, 29 Aug 2026: no tokens, no login,
no Authorize button. A request says who it is with a `user_id` query parameter or an
`X-User-Id` header.

The important part is that `CurrentUser` keeps the same name and the same type as it
would with real auth. Every router depends on `CurrentUser` and never on how identity
was established, so switching JWT back on means rewriting `get_current_user` in this
file and nothing else. See `planning/02-auth-decision.md`.
"""

from typing import Annotated

from fastapi import Depends, Header, Query
from sqlmodel import Session

from app.core.errors import NotFoundError, ValidationError
from app.database import get_session
from app.models import User

SessionDep = Annotated[Session, Depends(get_session)]

# Two ways to identify a caller, because they suit different clients:
#   - `?user_id=1`     easiest in Swagger, it is just a box on the page
#   - `X-User-Id: 1`   easiest in a frontend, set once in the fetch wrapper
UserIdQuery = Annotated[
    int | None,
    Query(description="Who is acting. Alternatively send an `X-User-Id` header."),
]
UserIdHeader = Annotated[int | None, Header(alias="X-User-Id", include_in_schema=False)]


def get_current_user(
    session: SessionDep,
    user_id: UserIdQuery = None,
    x_user_id: UserIdHeader = None,
) -> User:
    """Resolve the acting user. The query parameter wins if both are supplied."""
    resolved = user_id if user_id is not None else x_user_id
    if resolved is None:
        raise ValidationError(
            "Tell the API who you are: add ?user_id=<id> or an X-User-Id header. "
            "Create a user first with POST /users, or list them with GET /users."
        )

    user = session.get(User, resolved)
    if user is None:
        raise NotFoundError(
            f"No user with id {resolved}. Check GET /users for valid ids."
        )
    return user


def get_optional_user(
    session: SessionDep,
    user_id: UserIdQuery = None,
    x_user_id: UserIdHeader = None,
) -> User | None:
    """For endpoints that work anonymously but return more when they know the caller."""
    resolved = user_id if user_id is not None else x_user_id
    if resolved is None:
        return None
    return session.get(User, resolved)


CurrentUser = Annotated[User, Depends(get_current_user)]
OptionalUser = Annotated[User | None, Depends(get_optional_user)]
