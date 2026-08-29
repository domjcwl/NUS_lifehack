"""User routes.

There is no login. Create a user, keep its `id`, and send that id as `?user_id=` (or an
`X-User-Id` header) on any endpoint that needs to know who is acting.
"""

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import NotFoundError
from app.models import User
from app.schemas.user import UserCreate, UserRead
from app.services import user_service

router = APIRouter(tags=["users"])


@router.post(
    "/users",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
    summary="Create a user",
    description=(
        "Only `username` is required. Keep the returned `id` - it is how every other "
        "endpoint knows who is acting."
    ),
    responses={409: {"description": "Username or email already taken"}},
)
def create_user(payload: UserCreate, session: SessionDep) -> UserRead:
    user = user_service.create_user(session, payload)
    return UserRead.model_validate(user)


@router.get(
    "/users",
    response_model=list[UserRead],
    summary="List users",
    description="Handy for the demo and for picking an id to act as.",
)
def list_users(
    session: SessionDep, limit: int = Query(default=100, ge=1, le=500)
) -> list[UserRead]:
    return [UserRead.model_validate(u) for u in user_service.list_users(session, limit)]


@router.get(
    "/me",
    response_model=UserRead,
    summary="Who am I",
    description=(
        "Echoes back the user identified by `user_id` / `X-User-Id`. Useful for "
        "confirming the frontend is sending identity correctly."
    ),
    responses={
        404: {"description": "No user with that id"},
        422: {"description": "No user_id supplied"},
    },
)
def me(current_user: CurrentUser) -> UserRead:
    return UserRead.model_validate(current_user)


@router.get(
    "/users/{user_id}",
    response_model=UserRead,
    summary="Get one user",
    responses={404: {"description": "No user with that id"}},
)
def get_user(user_id: int, session: SessionDep) -> UserRead:
    user = session.get(User, user_id)
    if user is None:
        raise NotFoundError(f"No user with id {user_id}")
    return UserRead.model_validate(user)
