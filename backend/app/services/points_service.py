"""The points ledger.

Every point a user has ever earned is one row in `point_transactions`. Totals are
always summed from the ledger and never stored on the user, so a balance cannot drift
out of step with its history - and so the pitch's numbers are auditable rather than
asserted.
"""

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.logging import get_logger
from app.models import PointTransaction
from app.models.enums import PointReason

logger = get_logger(__name__)


def award(
    session: Session,
    *,
    user_id: int,
    points: int,
    reason: PointReason,
    group_id: int | None = None,
    activity_id: int | None = None,
    commit: bool = True,
) -> PointTransaction:
    """Append a ledger entry. Never edit an existing one - write a compensating row."""
    transaction = PointTransaction(
        user_id=user_id,
        group_id=group_id,
        activity_id=activity_id,
        points=points,
        reason=reason.value,
    )
    session.add(transaction)
    if commit:
        session.commit()
        session.refresh(transaction)

    logger.info(
        "Points awarded: user=%s group=%s points=%+d reason=%s",
        user_id,
        group_id,
        points,
        reason.value,
    )
    return transaction


def user_total(session: Session, user_id: int) -> int:
    statement = select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
        PointTransaction.user_id == user_id
    )
    return int(session.exec(statement).one())


def group_total(session: Session, group_id: int) -> int:
    statement = select(func.coalesce(func.sum(PointTransaction.points), 0)).where(
        PointTransaction.group_id == group_id
    )
    return int(session.exec(statement).one())
