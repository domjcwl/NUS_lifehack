"""Shared test fixtures.

Each test gets a fresh in-memory database, so tests never touch the dev SQLite file
and never depend on each other's data.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.pool import StaticPool
from sqlmodel import Session, SQLModel, create_engine

from app.database import get_session
from app.main import app


@pytest.fixture(name="session")
def session_fixture():
    # StaticPool keeps every connection pointed at the same in-memory database.
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        yield session


@pytest.fixture(name="client")
def client_fixture(session: Session):
    app.dependency_overrides[get_session] = lambda: session
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()


@pytest.fixture(name="user")
def user_fixture(client: TestClient) -> dict:
    """A created user, plus the header that identifies it on later requests."""
    response = client.post("/users", json={"username": "dominic"})
    assert response.status_code == 201, response.text
    body = response.json()
    return {
        "id": body["id"],
        "user": body,
        "headers": {"X-User-Id": str(body["id"])},
    }
