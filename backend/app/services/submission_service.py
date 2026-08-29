"""Recycling proof submission - the heart of the app.

The order of operations matters. Cheap rejections happen before expensive ones, and
nothing is written to disk or to the database until every check has passed:

    resolve QR -> validate stream -> validate file -> fingerprint
    -> cooldown -> daily cap -> duplicate image -> verify -> store -> award points

Anti-abuse here is deliberately MVP-level. It raises the cost of cheating above the
cost of walking to a bin, which is all a points game needs. It is not fraud detection,
and with authentication disabled anyone can act as anyone anyway.
"""

from datetime import timedelta

from sqlalchemy import func
from sqlmodel import Session, select

from app.agents.verification import get_verifier
from app.config import settings
from app.core.errors import ConflictError, NotFoundError, RateLimitError, ValidationError
from app.core.logging import get_logger
from app.integrations.storage import get_storage
from app.models import Bin, Group, GroupMember, RecyclingActivity, User
from app.models.enums import MediaType, PointReason, VerificationStatus, WasteType
from app.repositories import bin_repository
from app.schemas.activity import ActivityRead, SubmissionResult
from app.services import bin_service, points_service
from app.utils.hashing import dhash_image, hamming_distance, sha256_short
from app.utils.time import as_utc, utcnow

logger = get_logger(__name__)

# Two dHashes within this many bits are the same picture, resized or recompressed.
# Six is loose enough to survive a WhatsApp round trip, tight enough that two genuine
# photos of the same bin on different days do not collide.
_DUPLICATE_BIT_THRESHOLD = 6
# How far back to look for a duplicate. Bounded so the check stays O(small).
_DUPLICATE_LOOKBACK = 60


def _resolve_media_type(content_type: str) -> MediaType:
    if content_type in settings.allowed_image_types:
        return MediaType.IMAGE
    if content_type in settings.allowed_video_types:
        return MediaType.VIDEO
    allowed = sorted(settings.allowed_image_types | settings.allowed_video_types)
    raise ValidationError(
        f"Unsupported file type {content_type!r}. Allowed: {', '.join(allowed)}."
    )


def _validate_size(data: bytes) -> None:
    if not data:
        raise ValidationError("The uploaded file is empty.")
    if len(data) > settings.max_upload_bytes:
        actual_mb = len(data) / 1024 / 1024
        raise ValidationError(
            f"That file is {actual_mb:.1f} MB. The limit is {settings.MAX_UPLOAD_MB} MB."
        )


def _validate_waste_type(target: Bin, waste_type: WasteType | None) -> WasteType:
    """Default to what the bin is for, and reject a stream it does not take."""
    resolved = waste_type or target.type
    accepted = target.accepted_waste_types or [target.type.value]

    if resolved.value not in accepted:
        raise ValidationError(
            f"{target.name} does not accept {resolved.value.replace('_', '-')}. "
            f"It accepts: {', '.join(a.replace('_', '-') for a in accepted)}."
        )
    return resolved


def _validate_group(session: Session, user: User, group_id: int | None) -> int | None:
    if group_id is None:
        return None

    if session.get(Group, group_id) is None:
        raise NotFoundError(f"No group with id {group_id}")

    membership = session.exec(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == user.id
        )
    ).first()
    if membership is None:
        raise ValidationError(
            f"You are not a member of group {group_id}, so points cannot go to it."
        )
    return group_id


def _check_cooldown(session: Session, user: User, target: Bin) -> None:
    """One *scoring* submission per user per bin per cooldown window.

    Only approved submissions count. The cooldown exists to stop someone farming one
    bin for points, and a rejected submission earns none - locking a user out for an
    hour because their photo came out blurry punishes them for doing the right thing.
    """
    window_start = utcnow() - timedelta(minutes=settings.SUBMISSION_COOLDOWN_MINUTES)

    recent = session.exec(
        select(RecyclingActivity)
        .where(
            RecyclingActivity.user_id == user.id,
            RecyclingActivity.bin_id == target.id,
            RecyclingActivity.created_at >= window_start,
            RecyclingActivity.verification_status == VerificationStatus.APPROVED,
        )
        .order_by(RecyclingActivity.created_at.desc())
    ).first()

    if recent is None:
        return

    elapsed = (utcnow() - as_utc(recent.created_at)).total_seconds() / 60
    remaining = max(1, round(settings.SUBMISSION_COOLDOWN_MINUTES - elapsed))
    logger.info("Submission blocked by cooldown: user=%s bin=%s", user.id, target.id)
    raise RateLimitError(
        f"You already recycled at {target.name} recently. Try again in "
        f"{remaining} minute{'s' if remaining != 1 else ''}, or use a different bin."
    )


def _check_daily_cap(session: Session, user: User) -> None:
    since = utcnow() - timedelta(days=1)
    count = session.exec(
        select(func.count(RecyclingActivity.id)).where(
            RecyclingActivity.user_id == user.id,
            RecyclingActivity.created_at >= since,
        )
    ).one()

    if count >= settings.MAX_SUBMISSIONS_PER_DAY:
        logger.info("Submission blocked by daily cap: user=%s count=%s", user.id, count)
        raise RateLimitError(
            f"You have hit the daily limit of {settings.MAX_SUBMISSIONS_PER_DAY} "
            "submissions. It resets 24 hours after your earliest one."
        )


def _check_duplicate(session: Session, user: User, media_hash: str) -> None:
    """Reject a photo this user has already submitted, even if resized or recompressed."""
    previous = session.exec(
        select(RecyclingActivity)
        .where(
            RecyclingActivity.user_id == user.id,
            RecyclingActivity.media_hash.is_not(None),
            # A rejected photo never earned anything, so re-sending a better version
            # of the same scene is legitimate retrying, not duplicate farming.
            RecyclingActivity.verification_status == VerificationStatus.APPROVED,
        )
        .order_by(RecyclingActivity.created_at.desc())
        .limit(_DUPLICATE_LOOKBACK)
    ).all()

    for earlier in previous:
        if hamming_distance(media_hash, earlier.media_hash) <= _DUPLICATE_BIT_THRESHOLD:
            logger.info(
                "Submission blocked as duplicate: user=%s matches activity=%s",
                user.id,
                earlier.id,
            )
            raise ConflictError(
                "You have already submitted this photo. Take a new one at the bin."
            )


def submit(
    session: Session,
    *,
    user: User,
    qr_code_id: str,
    data: bytes,
    content_type: str,
    waste_type: WasteType | None = None,
    caption: str | None = None,
    group_id: int | None = None,
) -> SubmissionResult:
    """Run every check, then record the activity and award the points."""
    target = bin_repository.get_by_qr_code(session, qr_code_id)
    if target is None:
        raise NotFoundError(f"QR code {qr_code_id!r} is not recognised.")
    if not target.active:
        raise NotFoundError(f"{target.name} is currently out of service.")

    resolved_waste_type = _validate_waste_type(target, waste_type)
    resolved_group_id = _validate_group(session, user, group_id)

    media_type = _resolve_media_type(content_type)
    _validate_size(data)

    if media_type == MediaType.IMAGE:
        media_hash = dhash_image(data)
        if media_hash is None:
            raise ValidationError(
                "That file claims to be an image but could not be read. "
                "Try taking the photo again."
            )
    else:
        media_hash = sha256_short(data)

    _check_cooldown(session, user, target)
    _check_daily_cap(session, user)
    _check_duplicate(session, user, media_hash)

    result = get_verifier().verify(data, media_type, resolved_waste_type.value)

    # Only store the file once it is going to be kept, so rejected junk never lands
    # on disk.
    media_url = get_storage().save(data, f"proof{media_type.value}", content_type)

    approved = result.status == VerificationStatus.APPROVED
    points = bin_service.points_for(resolved_waste_type) if approved else 0

    activity = RecyclingActivity(
        user_id=user.id,
        group_id=resolved_group_id,
        bin_id=target.id,
        waste_type=resolved_waste_type,
        media_url=media_url,
        media_type=media_type,
        media_hash=media_hash,
        caption=caption.strip() if caption else None,
        verification_status=result.status,
        verification_score=result.score,
        verification_note=result.note,
        points_awarded=points,
    )
    session.add(activity)
    session.commit()
    session.refresh(activity)

    bonus = 0
    if approved:
        points_service.award(
            session,
            user_id=user.id,
            group_id=resolved_group_id,
            activity_id=activity.id,
            points=points,
            reason=PointReason.RECYCLING_ACTIVITY,
        )
        bonus = _award_first_submission_bonus(
            session, user, resolved_group_id, activity.id
        )

    logger.info(
        "Submission recorded: activity=%s user=%s bin=%s type=%s status=%s points=%d",
        activity.id,
        user.id,
        target.id,
        resolved_waste_type.value,
        result.status.value,
        points + bonus,
    )

    return SubmissionResult(
        activity=ActivityRead.model_validate(activity),
        points_awarded=points,
        bonus_awarded=bonus,
        user_total_points=points_service.user_total(session, user.id),
        group_total_points=(
            points_service.group_total(session, resolved_group_id)
            if resolved_group_id
            else None
        ),
        message=_message_for(result.status, points, bonus, target.name, result.note),
    )


def _message_for(
    status: VerificationStatus, points: int, bonus: int, bin_name: str, note: str
) -> str:
    if status != VerificationStatus.APPROVED:
        return note
    earned = points + bonus
    line = f"Nice one - {earned} points for recycling at {bin_name}."
    if bonus:
        line += f" That includes a {bonus} point bonus for your first submission."
    return line


def _award_first_submission_bonus(
    session: Session, user: User, group_id: int | None, activity_id: int
) -> int:
    """A one-off bonus for the first ever submission.

    Behaviourally this is the cheapest lever available: the hardest submission to get
    out of someone is the first one, so that is where the reward should be largest.
    """
    if settings.POINTS_FIRST_SUBMISSION_BONUS <= 0:
        return 0

    approved_count = session.exec(
        select(func.count(RecyclingActivity.id)).where(
            RecyclingActivity.user_id == user.id,
            RecyclingActivity.verification_status == VerificationStatus.APPROVED,
        )
    ).one()

    if approved_count != 1:
        return 0

    points_service.award(
        session,
        user_id=user.id,
        group_id=group_id,
        activity_id=activity_id,
        points=settings.POINTS_FIRST_SUBMISSION_BONUS,
        reason=PointReason.FIRST_SUBMISSION_BONUS,
    )
    return settings.POINTS_FIRST_SUBMISSION_BONUS
