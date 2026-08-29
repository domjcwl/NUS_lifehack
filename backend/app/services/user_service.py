"""User business logic.

Route handlers stay thin: they parse and delegate here.
"""

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.errors import ConflictError
from app.core.logging import get_logger
from app.models import User
from app.schemas.user import UserCreate

logger = get_logger(__name__)


def find_by_username(session: Session, username: str) -> User | None:
    # Case-insensitive, so "Dominic" and "dominic" are the same account.
    statement = select(User).where(func.lower(User.username) == username.strip().lower())
    return session.exec(statement).first()


def find_by_email(session: Session, email: str) -> User | None:
    statement = select(User).where(func.lower(User.email) == email.strip().lower())
    return session.exec(statement).first()


def create_user(session: Session, payload: UserCreate) -> User:
    """Create an account. Raises ConflictError if the username or email is taken."""
    if find_by_username(session, payload.username):
        logger.info("User creation rejected: username %r exists", payload.username)
        raise ConflictError(
            f"The username {payload.username!r} is already taken. Pick a different one."
        )
    if payload.email and find_by_email(session, payload.email):
        logger.info("User creation rejected: email already registered")
        raise ConflictError("An account with that email already exists.")

    user = User(
        username=payload.username.strip(),
        email=payload.email.strip().lower() if payload.email else None,
        display_name=(payload.display_name or payload.username).strip(),
    )
    session.add(user)
    session.commit()
    session.refresh(user)

    logger.info("User created: id=%s username=%s", user.id, user.username)
    return user


def list_users(session: Session, limit: int = 100) -> list[User]:
    statement = select(User).order_by(User.id).limit(limit)
    return list(session.exec(statement).all())
