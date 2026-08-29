"""Group business logic.

Groups are the social half of the behaviour loop. Points earned alone are a score;
points earned for a group your friends can see are social pressure, and that is the
part the brief cares about.
"""

from sqlmodel import Session

from app.config import settings
from app.core.errors import ConflictError, NotFoundError, ValidationError
from app.core.logging import get_logger
from app.models import Bin, Group, GroupMember, RecyclingActivity, User
from app.models.enums import VerificationStatus, WasteType
from app.repositories import group_repository
from app.schemas.group import (
    ActivityFeedItem,
    GroupDetail,
    GroupMemberRead,
    GroupRead,
    LeaderboardEntry,
)
from app.utils.codes import generate_invite_code, normalise_invite_code

logger = get_logger(__name__)

# Collisions are vanishingly unlikely at 30^6, but a retry loop costs nothing and
# turns an impossible-but-fatal error into a non-event.
_CODE_ATTEMPTS = 10


def get_group(session: Session, group_id: int) -> Group:
    group = session.get(Group, group_id)
    if group is None:
        raise NotFoundError(f"No group with id {group_id}")
    return group


def _unique_invite_code(session: Session) -> str:
    for _ in range(_CODE_ATTEMPTS):
        code = generate_invite_code()
        if group_repository.get_by_invite_code(session, code) is None:
            return code
    raise ConflictError("Could not allocate an invite code. Please try again.")


def create_group(session: Session, creator: User, name: str) -> GroupDetail:
    """Create a group. The creator is its first member."""
    group = Group(
        name=name.strip(),
        creator_id=creator.id,
        invite_code=_unique_invite_code(session),
    )
    session.add(group)
    session.commit()
    session.refresh(group)

    session.add(GroupMember(group_id=group.id, user_id=creator.id))
    session.commit()

    logger.info(
        "Group created: id=%s name=%r creator=%s code=%s",
        group.id,
        group.name,
        creator.id,
        group.invite_code,
    )
    return to_detail(session, group)


def join_group(session: Session, user: User, group: Group) -> GroupDetail:
    if group_repository.get_membership(session, group.id, user.id) is not None:
        raise ConflictError(f"You are already a member of {group.name}.")

    if group_repository.member_count(session, group.id) >= settings.MAX_GROUP_MEMBERS:
        raise ConflictError(
            f"{group.name} is full ({settings.MAX_GROUP_MEMBERS} members)."
        )

    session.add(GroupMember(group_id=group.id, user_id=user.id))
    session.commit()

    logger.info("User %s joined group %s", user.id, group.id)
    return to_detail(session, group)


def join_by_code(session: Session, user: User, invite_code: str) -> GroupDetail:
    code = normalise_invite_code(invite_code)
    group = group_repository.get_by_invite_code(session, code)
    if group is None:
        raise NotFoundError(
            f"No group has the code {code!r}. Check with whoever shared it."
        )
    return join_group(session, user, group)


def leave_group(session: Session, user: User, group: Group) -> None:
    """Leave a group.

    The creator may leave like anyone else. `creator_id` is kept as a record of who
    started the group, not as an active role, so nothing needs transferring. Past
    activities and point transactions stay attributed to the group - removing them
    would silently rewrite the group's history.
    """
    membership = group_repository.get_membership(session, group.id, user.id)
    if membership is None:
        raise ValidationError(f"You are not a member of {group.name}.")

    session.delete(membership)
    session.commit()
    logger.info("User %s left group %s", user.id, group.id)


def to_detail(session: Session, group: Group) -> GroupDetail:
    return GroupDetail(
        **GroupRead.model_validate(group).model_dump(),
        member_count=group_repository.member_count(session, group.id),
        total_points=group_repository.total_points(session, group.id),
        activity_count=group_repository.activity_count(session, group.id),
    )


def list_members(session: Session, group: Group) -> list[GroupMemberRead]:
    rows = group_repository.list_members_with_stats(session, group.id)
    return [GroupMemberRead(**row) for row in rows]


def leaderboard(session: Session, group: Group) -> list[LeaderboardEntry]:
    """Members ranked by points contributed to this group.

    Ties share a rank - two people on 40 points are both second, and the next is
    fourth. Inventing an order between equal scores would be arbitrary and visibly
    unfair to the person who lost the coin flip.
    """
    rows = group_repository.list_members_with_stats(session, group.id)
    rows.sort(key=lambda r: (-r["points"], -r["activity_count"], r["username"].lower()))

    entries: list[LeaderboardEntry] = []
    previous_points: int | None = None
    rank = 0
    for index, row in enumerate(rows, start=1):
        if row["points"] != previous_points:
            rank = index
            previous_points = row["points"]
        entries.append(
            LeaderboardEntry(
                rank=rank,
                user_id=row["user_id"],
                username=row["username"],
                display_name=row["display_name"],
                points=row["points"],
                activity_count=row["activity_count"],
            )
        )
    return entries


_WASTE_LABEL = {
    WasteType.RECYCLING: ("recycled", "♻️"),
    WasteType.E_WASTE: ("recycled e-waste", "🔌"),
}


def _feed_sentence(
    display: str, activity: RecyclingActivity, bin_name: str
) -> str:
    verb, emoji = _WASTE_LABEL[activity.waste_type]

    if activity.verification_status != VerificationStatus.APPROVED:
        return f"{display} submitted proof at {bin_name} - not verified"

    return f"{display} {verb} {emoji} +{activity.points_awarded} points"


def activity_feed(
    session: Session, group: Group, limit: int, offset: int
) -> list[ActivityFeedItem]:
    rows = group_repository.list_activities_with_context(
        session, group.id, limit=limit, offset=offset
    )

    feed: list[ActivityFeedItem] = []
    for activity, user, target in rows:
        display = user.display_name or user.username
        feed.append(
            ActivityFeedItem(
                activity_id=activity.id,
                user_id=user.id,
                username=user.username,
                display_name=user.display_name,
                bin_id=target.id,
                bin_name=target.name,
                waste_type=activity.waste_type,
                points_awarded=activity.points_awarded,
                caption=activity.caption,
                media_url=activity.media_url,
                verification_status=activity.verification_status,
                created_at=activity.created_at,
                text=_feed_sentence(display, activity, target.name),
            )
        )
    return feed


def list_user_groups(session: Session, user_id: int) -> list[GroupDetail]:
    groups = group_repository.list_groups_for_user(session, user_id)
    return [to_detail(session, group) for group in groups]


__all__ = [
    "Bin",
    "activity_feed",
    "create_group",
    "get_group",
    "join_by_code",
    "join_group",
    "leaderboard",
    "leave_group",
    "list_members",
    "list_user_groups",
    "to_detail",
]
