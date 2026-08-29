"""Load demo data into the database.

    python scripts/seed.py

Idempotent: bins are matched on `qr_code_id`, so running it twice does not duplicate
anything, and re-running after editing `app/seeds/bins.py` updates the existing rows.
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlmodel import Session  # noqa: E402

from app.database import create_db_and_tables, engine  # noqa: E402
from app.models import Bin  # noqa: E402
from app.repositories import bin_repository  # noqa: E402
from app.seeds.bins import BIN_SEEDS  # noqa: E402


def seed_bins(session: Session) -> tuple[int, int]:
    created = updated = 0
    for record in BIN_SEEDS:
        existing = bin_repository.get_by_qr_code(session, record["qr_code_id"])
        if existing is None:
            session.add(Bin(**record))
            created += 1
        else:
            for field, value in record.items():
                setattr(existing, field, value)
            session.add(existing)
            updated += 1
    session.commit()
    return created, updated


def main() -> None:
    create_db_and_tables()
    with Session(engine) as session:
        created, updated = seed_bins(session)

    print(f"Bins: {created} created, {updated} updated.")
    print("Try it:")
    print("  http://127.0.0.1:8000/bins/nearby?latitude=1.2966&longitude=103.7729")
    print("  http://127.0.0.1:8000/recycle/sg-nus-lib-01")


if __name__ == "__main__":
    main()
