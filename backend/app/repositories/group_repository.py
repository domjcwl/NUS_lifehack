"""Group queries that involve joins or aggregation.

Plain lookups by id stay in the service, straight off the session.
"""

from sqlalchemy import func
from sqlmodel import Session, select

from app.models import (
    Bin,
    Group,
    GroupMember,
    PointTransaction,
    RecyclingActivity,
    User,
)
from app.models.enums import VerificationStatus


def get_by_invite_code(session: Session, invite_code: str) -> Group | None:
    statement = select(Group).where(Group.invite_code == invite_code)
    return session.exec(statement).first()


def get_membership(
    session: Session, group_id: int, user_id: int
) -> GroupMember | None:
    statement = select(GroupMember).where(
        GroupMember.group_id == group_id, GroupMember.user_id == user_id
    )
    return session.exec(statement).first()


def member_count(session: Session, group_id: int) -> int:
    statement = select(func.count(GroupMember.id)).where(
        GroupMember.group_id == group_id
    )
    return int(session.exec(statement).one())


def total_points(session: Session, group_id: int) -> int:
    statement = select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
        PointTransaction.group_id == group_id
    )
    return int(session.exec(statement).one())


def activity_count(session: Session, group_id: int) -> int:
    statement = select(func.count(RecyclingActivity.id)).where(
        RecyclingActivity.group_id == group_id,
        RecyclingActivity.verification_status == VerificationStatus.APPROVED,
    )
    return int(session.exec(statement).one())


def list_groups_for_user(session: Session, user_id: int) -> list[Group]:
    statement = (
        select(Group)
        .join(GroupMember, GroupMember.group_id == Group.id)
        .where(GroupMember.user_id == user_id)
        .order_by(Group.created_at.desc())
    )
    return list(session.exec(statement).all())


def _points_by_user(session: Session, group_id: int) -> dict[int, int]:
    """Points each member has contributed to this group, in one query."""
    statement = (
        select(PointTransaction.user_id, func.sum(PointTransaction.points))
        .where(PointTransaction.group_id == group_id)
        .group_by(PointTransaction.user_id)
    )
    return {user_id: int(total) for user_id, total in session.exec(statement).all()}


def _activities_by_user(session: Session, group_id: int) -> dict[int, int]:
    statement = (
        select(RecyclingActivity.user_id, func.count(RecyclingActivity.id))
        .where(
            RecyclingActivity.group_id == group_id,
            RecyclingActivity.verification_status == VerificationStatus.APPROVED,
        )
        .group_by(RecyclingActivity.user_id)
    )
    return {user_id: int(count) for user_id, count in session.exec(statement).all()}


def list_members_with_stats(session: Session, group_id: int) -> list[dict]:
    """Members plus their contribution. Three queries, not one per member."""
    rows = session.exec(
        select(User, GroupMember)
        .join(GroupMember, GroupMember.user_id == User.id)
        .where(GroupMember.group_id == group_id)
        .order_by(GroupMember.joined_at)
    ).all()

    points = _points_by_user(session, group_id)
    activities = _activities_by_user(session, group_id)

    return [
        {
            "user_id": user.id,
            "username": user.username,
            "display_name": user.display_name,
            "joined_at": membership.joined_at,
            "points": points.get(user.id, 0),
            "activity_count": activities.get(user.id, 0),
        }
        for user, membership in rows
    ]


def list_activities_with_context(
    session: Session, group_id: int, limit: int, offset: int
) -> list[tuple[RecyclingActivity, User, Bin]]:
    """Feed rows joined to the user and bin they reference, newest first."""
    statement = (
        select(RecyclingActivity, User, Bin)
        .join(User, User.id == RecyclingActivity.user_id)
        .join(Bin, Bin.id == RecyclingActivity.bin_id)
        .where(RecyclingActivity.group_id == group_id)
        .order_by(RecyclingActivity.created_at.desc(), RecyclingActivity.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(session.exec(statement).all())
