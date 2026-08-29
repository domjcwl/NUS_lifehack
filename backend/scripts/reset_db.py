"""Wipe the local database and recreate empty tables.

    python scripts/reset_db.py

Useful whenever a model changes (there are no migrations by design) or when test data
has piled up and you want a clean demo. Refuses to touch anything but SQLite.
"""

import sys
from pathlib import Path

# Allow running as `python scripts/reset_db.py` from the backend directory.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import SQLModel  # noqa: E402

from app.config import settings  # noqa: E402
from app.database import create_db_and_tables, engine  # noqa: E402


def main() -> None:
    if not settings.DATABASE_URL.startswith("sqlite"):
        print(f"Refusing to reset a non-SQLite database: {settings.DATABASE_URL}")
        raise SystemExit(1)

    SQLModel.metadata.drop_all(engine)
    create_db_and_tables()
    print(f"Reset {settings.DATABASE_URL} - all tables are empty.")
    print("Create a user with POST /users at http://127.0.0.1:8000/docs")


if __name__ == "__main__":
    main()
