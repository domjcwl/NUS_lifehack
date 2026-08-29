"""Group routes."""

from fastapi import APIRouter, Query, status

from app.core.deps import CurrentUser, SessionDep
from app.core.errors import NotFoundError
from app.models import User
from app.schemas.group import (
    ActivityFeedItem,
    GroupCreate,
    GroupDetail,
    GroupJoinByCode,
    GroupMemberRead,
    LeaderboardEntry,
)
from app.services import group_service

router = APIRouter(tags=["groups"])


@router.post(
    "/groups",
    response_model=GroupDetail,
    status_code=status.HTTP_201_CREATED,
    summary="Create a group",
    description=(
        "The creator becomes its first member. The response includes an `invite_code` "
        "to share - it is far easier to read aloud than a numeric id."
    ),
)
def create_group(
    payload: GroupCreate, session: SessionDep, current_user: CurrentUser
) -> GroupDetail:
    return group_service.create_group(session, current_user, payload.name)


@router.post(
    "/groups/join",
    response_model=GroupDetail,
    summary="Join a group using an invite code",
    description="Case and dashes are ignored, so `7kpq-4m` works as well as `7KPQ4M`.",
    responses={
        404: {"description": "No group has that code"},
        409: {"description": "Already a member, or the group is full"},
    },
)
def join_by_code(
    payload: GroupJoinByCode, session: SessionDep, current_user: CurrentUser
) -> GroupDetail:
    return group_service.join_by_code(session, current_user, payload.invite_code)


@router.post(
    "/groups/{group_id}/join",
    response_model=GroupDetail,
    summary="Join a group by id",
    responses={
        404: {"description": "No group with that id"},
        409: {"description": "Already a member, or the group is full"},
    },
)
def join_group(
    group_id: int, session: SessionDep, current_user: CurrentUser
) -> GroupDetail:
    group = group_service.get_group(session, group_id)
    return group_service.join_group(session, current_user, group)


@router.post(
    "/groups/{group_id}/leave",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Leave a group",
    description=(
        "Past activities stay attributed to the group - leaving does not rewrite its "
        "history. The creator may leave like any other member."
    ),
    responses={
        404: {"description": "No group with that id"},
        422: {"description": "You are not a member"},
    },
)
def leave_group(group_id: int, session: SessionDep, current_user: CurrentUser) -> None:
    group = group_service.get_group(session, group_id)
    group_service.leave_group(session, current_user, group)


@router.get(
    "/groups/{group_id}",
    response_model=GroupDetail,
    summary="Get a group",
    responses={404: {"description": "No group with that id"}},
)
def get_group(group_id: int, session: SessionDep) -> GroupDetail:
    return group_service.to_detail(session, group_service.get_group(session, group_id))


@router.get(
    "/groups/{group_id}/members",
    response_model=list[GroupMemberRead],
    summary="List members and what each has contributed",
    description="In join order.",
    responses={404: {"description": "No group with that id"}},
)
def list_members(group_id: int, session: SessionDep) -> list[GroupMemberRead]:
    return group_service.list_members(session, group_service.get_group(session, group_id))


@router.get(
    "/groups/{group_id}/leaderboard",
    response_model=list[LeaderboardEntry],
    summary="Rank members by points contributed to this group",
    description="Ties share a rank: two members on 40 points are both second.",
    responses={404: {"description": "No group with that id"}},
)
def leaderboard(group_id: int, session: SessionDep) -> list[LeaderboardEntry]:
    return group_service.leaderboard(session, group_service.get_group(session, group_id))


@router.get(
    "/groups/{group_id}/activities",
    response_model=list[ActivityFeedItem],
    summary="The group's activity feed",
    description=(
        "Newest first. Each item carries a ready-made `text` line such as "
        "`Dominic recycled e-waste 🔌 +20 points`, so every client renders it the same."
    ),
    responses={404: {"description": "No group with that id"}},
)
def activity_feed(
    group_id: int,
    session: SessionDep,
    limit: int = Query(default=25, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
) -> list[ActivityFeedItem]:
    group = group_service.get_group(session, group_id)
    return group_service.activity_feed(session, group, limit=limit, offset=offset)


@router.get(
    "/users/{user_id}/groups",
    response_model=list[GroupDetail],
    summary="Groups a user belongs to",
    responses={404: {"description": "No user with that id"}},
)
def list_user_groups(user_id: int, session: SessionDep) -> list[GroupDetail]:
    if session.get(User, user_id) is None:
        raise NotFoundError(f"No user with id {user_id}")
    return group_service.list_user_groups(session, user_id)
