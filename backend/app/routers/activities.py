"""Activity read routes."""

from fastapi import APIRouter, Query
from sqlmodel import select

from app.core.deps import SessionDep
from app.core.errors import NotFoundError
from app.models import RecyclingActivity, User
from app.models.enums import WasteType
from app.schemas.activity import ActivityRead

router = APIRouter(tags=["activities"])


@router.get(
    "/activities/{activity_id}",
    response_model=ActivityRead,
    summary="Get one recycling activity",
    responses={404: {"description": "No activity with that id"}},
)
def get_activity(activity_id: int, session: SessionDep) -> ActivityRead:
    activity = session.get(RecyclingActivity, activity_id)
    if activity is None:
        raise NotFoundError(f"No activity with id {activity_id}")
    return ActivityRead.model_validate(activity)


@router.get(
    "/users/{user_id}/activities",
    response_model=list[ActivityRead],
    summary="A user's recycling history",
    description="Newest first. This is the raw material for the measurement story.",
    responses={404: {"description": "No user with that id"}},
)
def list_user_activities(
    user_id: int,
    session: SessionDep,
    waste_type: WasteType | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
) -> list[ActivityRead]:
    if session.get(User, user_id) is None:
        raise NotFoundError(f"No user with id {user_id}")

    statement = select(RecyclingActivity).where(RecyclingActivity.user_id == user_id)
    if waste_type is not None:
        statement = statement.where(RecyclingActivity.waste_type == waste_type)

    statement = (
        statement.order_by(RecyclingActivity.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    return [ActivityRead.model_validate(a) for a in session.exec(statement).all()]
