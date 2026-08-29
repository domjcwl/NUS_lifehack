"""Recycling proof submission, anti-abuse and the points ledger."""

import random
from datetime import timedelta
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session, select

from app.config import settings
from app.models import Bin, RecyclingActivity
from app.seeds.bins import BIN_SEEDS
from app.utils.hashing import dhash_image, hamming_distance
from app.utils.time import utcnow

RECYCLING_QR = "sg-nus-lib-01"
EWASTE_QR = "sg-nus-eng-ew-01"
BOTH_QR = "sg-nus-pgp-01"
INACTIVE_QR = "sg-nus-sci-01"


def photo(seed: int = 0, size: tuple[int, int] = (640, 480)) -> bytes:
    """A deterministic noisy JPEG. Noise matters: the verifier rejects blank images."""
    rng = random.Random(seed)
    image = Image.new("RGB", size)
    image.putdata(
        [
            (rng.randrange(256), rng.randrange(256), rng.randrange(256))
            for _ in range(size[0] * size[1])
        ]
    )
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def blank_photo(size: tuple[int, int] = (640, 480)) -> bytes:
    buffer = BytesIO()
    Image.new("RGB", size, (200, 200, 200)).save(buffer, format="JPEG")
    return buffer.getvalue()


def upload(
    client: TestClient,
    qr: str,
    user_id: int,
    data: bytes | None = None,
    content_type: str = "image/jpeg",
    **form,
):
    return client.post(
        f"/recycle/{qr}/submit",
        params={"user_id": user_id},
        files={"file": ("proof.jpg", data if data is not None else photo(), content_type)},
        data=form,
    )


@pytest.fixture(name="app_client")
def app_client_fixture(session: Session, client: TestClient, tmp_path, monkeypatch):
    # Uploads go to a temp directory so tests never litter backend/uploads.
    from app.integrations import storage

    storage.get_storage.cache_clear()
    monkeypatch.setattr(settings, "STORAGE_DIR", str(tmp_path))

    for record in BIN_SEEDS:
        session.add(Bin(**record))
    session.commit()
    yield client
    storage.get_storage.cache_clear()


@pytest.fixture(name="uid")
def uid_fixture(app_client: TestClient) -> int:
    return app_client.post("/users", json={"username": "dominic"}).json()["id"]


# --- the happy path ---------------------------------------------------------


def test_submit_recycling_awards_points(app_client: TestClient, uid: int):
    response = upload(app_client, RECYCLING_QR, uid)
    assert response.status_code == 201, response.text
    body = response.json()

    assert body["points_awarded"] == 10
    assert body["activity"]["verification_status"] == "approved"
    assert body["activity"]["waste_type"] == "recycling"
    assert body["activity"]["media_url"].startswith("/media/")
    # First ever submission also earns the one-off bonus.
    assert body["bonus_awarded"] == settings.POINTS_FIRST_SUBMISSION_BONUS
    assert body["user_total_points"] == 10 + settings.POINTS_FIRST_SUBMISSION_BONUS
    assert "35 points" in body["message"]


def test_ewaste_is_worth_more_than_recycling(app_client: TestClient, uid: int):
    body = upload(app_client, EWASTE_QR, uid).json()
    assert body["points_awarded"] == 20
    assert body["activity"]["waste_type"] == "e_waste"


def test_bonus_is_only_paid_once(app_client: TestClient, uid: int):
    first = upload(app_client, RECYCLING_QR, uid).json()
    second = upload(app_client, EWASTE_QR, uid, data=photo(seed=2)).json()

    assert first["bonus_awarded"] == settings.POINTS_FIRST_SUBMISSION_BONUS
    assert second["bonus_awarded"] == 0
    assert second["user_total_points"] == 10 + 20 + settings.POINTS_FIRST_SUBMISSION_BONUS


def test_caption_is_stored(app_client: TestClient, uid: int):
    body = upload(app_client, RECYCLING_QR, uid, caption="Old keyboard, finally!").json()
    assert body["activity"]["caption"] == "Old keyboard, finally!"


def test_uploaded_file_is_persisted_with_the_original_bytes(
    app_client: TestClient, uid: int, tmp_path
):
    data = photo(seed=21)
    media_url = upload(app_client, RECYCLING_QR, uid, data=data).json()["activity"][
        "media_url"
    ]
    # The URL is what /media serves; the file must exist under the storage directory
    # with exactly the bytes that were uploaded.
    stored = tmp_path / media_url.rsplit("/", 1)[-1]
    assert stored.exists()
    assert stored.read_bytes() == data


def test_media_is_mounted_for_serving(app_client: TestClient):
    """The /media mount must exist, or uploaded proof would never render."""
    from app.main import app

    assert any(getattr(r, "path", None) == "/media" for r in app.routes)


def test_points_ledger_records_every_award(
    app_client: TestClient, uid: int, session: Session
):
    upload(app_client, RECYCLING_QR, uid)
    from app.models import PointTransaction

    rows = session.exec(
        select(PointTransaction).where(PointTransaction.user_id == uid)
    ).all()
    reasons = {r.reason for r in rows}
    assert reasons == {"recycling_activity", "first_submission_bonus"}
    assert sum(r.points for r in rows) == 10 + settings.POINTS_FIRST_SUBMISSION_BONUS


# --- waste type rules -------------------------------------------------------


def test_waste_type_defaults_to_the_bin(app_client: TestClient, uid: int):
    body = upload(app_client, EWASTE_QR, uid).json()
    assert body["activity"]["waste_type"] == "e_waste"


def test_a_bin_refuses_a_stream_it_does_not_accept(app_client: TestClient, uid: int):
    response = upload(app_client, RECYCLING_QR, uid, waste_type="e_waste")
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "does not accept" in detail
    # The message must say what the bin does take, not just what it refuses.
    assert "recycling" in detail


def test_a_dual_stream_bin_accepts_either(app_client: TestClient, uid: int, monkeypatch):
    # Prince George's Park takes both streams. Cooldown off so the second submission
    # is judged on waste type alone.
    monkeypatch.setattr(settings, "SUBMISSION_COOLDOWN_MINUTES", 0)
    assert (
        upload(app_client, BOTH_QR, uid, data=photo(8), waste_type="recycling").status_code
        == 201
    )
    assert (
        upload(app_client, BOTH_QR, uid, data=photo(9), waste_type="e_waste").status_code
        == 201
    )


# --- QR and identity --------------------------------------------------------


def test_unknown_qr_code_is_404(app_client: TestClient, uid: int):
    assert upload(app_client, "not-a-code", uid).status_code == 404


def test_inactive_bin_is_refused(app_client: TestClient, uid: int):
    response = upload(app_client, INACTIVE_QR, uid)
    assert response.status_code == 404
    assert "out of service" in response.json()["detail"]


def test_submission_without_identity_is_422(app_client: TestClient):
    response = app_client.post(
        f"/recycle/{RECYCLING_QR}/submit",
        files={"file": ("proof.jpg", photo(), "image/jpeg")},
    )
    assert response.status_code == 422
    assert "user_id" in response.json()["detail"]


def test_submission_as_unknown_user_is_404(app_client: TestClient):
    assert upload(app_client, RECYCLING_QR, 4242).status_code == 404


# --- file validation --------------------------------------------------------


def test_unsupported_file_type_is_rejected(app_client: TestClient, uid: int):
    response = upload(
        app_client, RECYCLING_QR, uid, data=b"#!/bin/sh\n", content_type="text/x-shellscript"
    )
    assert response.status_code == 422
    assert "Unsupported file type" in response.json()["detail"]


def test_empty_file_is_rejected(app_client: TestClient, uid: int):
    response = upload(app_client, RECYCLING_QR, uid, data=b"")
    assert response.status_code == 422


def test_bytes_that_are_not_really_an_image_are_rejected(app_client: TestClient, uid: int):
    response = upload(app_client, RECYCLING_QR, uid, data=b"definitely not a jpeg")
    assert response.status_code == 422
    assert "could not be read" in response.json()["detail"]


def test_oversized_file_is_rejected(app_client: TestClient, uid: int, monkeypatch):
    monkeypatch.setattr(settings, "MAX_UPLOAD_MB", 1)
    big = photo(seed=1, size=(3000, 3000))
    assert len(big) > 1024 * 1024
    response = upload(app_client, RECYCLING_QR, uid, data=big)
    assert response.status_code == 422
    assert "limit is 1 MB" in response.json()["detail"]


def test_a_blank_image_is_rejected_and_earns_nothing(app_client: TestClient, uid: int):
    response = upload(app_client, RECYCLING_QR, uid, data=blank_photo())
    assert response.status_code == 201
    body = response.json()
    assert body["activity"]["verification_status"] == "rejected"
    assert body["points_awarded"] == 0
    assert body["user_total_points"] == 0
    assert "blank" in body["message"]


def test_a_thumbnail_sized_image_is_rejected(app_client: TestClient, uid: int):
    response = upload(app_client, RECYCLING_QR, uid, data=photo(size=(80, 60)))
    assert response.json()["activity"]["verification_status"] == "rejected"


# --- anti-abuse -------------------------------------------------------------


def test_same_bin_twice_hits_the_cooldown(app_client: TestClient, uid: int):
    assert upload(app_client, RECYCLING_QR, uid).status_code == 201
    response = upload(app_client, RECYCLING_QR, uid, data=photo(seed=7))
    assert response.status_code == 429
    detail = response.json()["detail"]
    assert "Try again in" in detail
    assert "different bin" in detail


def test_a_rejected_submission_does_not_start_the_cooldown(
    app_client: TestClient, uid: int
):
    """A blurry photo earns nothing, so it must not lock the user out of the bin
    they just walked to. Retrying immediately has to work."""
    first = upload(app_client, RECYCLING_QR, uid, data=blank_photo())
    assert first.json()["activity"]["verification_status"] == "rejected"

    retry = upload(app_client, RECYCLING_QR, uid, data=photo(seed=31))
    assert retry.status_code == 201, retry.text
    assert retry.json()["points_awarded"] == 10


def test_a_rejected_photo_can_be_resubmitted(app_client: TestClient, uid: int):
    """Duplicate detection must not block retrying a shot that was refused."""
    blank = blank_photo()
    assert upload(app_client, RECYCLING_QR, uid, data=blank).json()["activity"][
        "verification_status"
    ] == "rejected"
    # The same rejected image again is still rejected on quality, but never as a
    # duplicate - the user is retrying, not farming.
    again = upload(app_client, RECYCLING_QR, uid, data=blank)
    assert again.status_code == 201
    assert again.json()["activity"]["verification_status"] == "rejected"


def test_a_different_bin_is_fine_during_the_cooldown(app_client: TestClient, uid: int):
    assert upload(app_client, RECYCLING_QR, uid).status_code == 201
    assert upload(app_client, EWASTE_QR, uid, data=photo(seed=3)).status_code == 201


def test_cooldown_expires(app_client: TestClient, uid: int, session: Session):
    upload(app_client, RECYCLING_QR, uid)

    # Backdate the submission past the cooldown window.
    activity = session.exec(select(RecyclingActivity)).one()
    activity.created_at = utcnow() - timedelta(
        minutes=settings.SUBMISSION_COOLDOWN_MINUTES + 5
    )
    session.add(activity)
    session.commit()

    assert upload(app_client, RECYCLING_QR, uid, data=photo(seed=11)).status_code == 201


def test_reuploading_the_same_photo_is_refused(app_client: TestClient, uid: int):
    identical = photo(seed=42)
    assert upload(app_client, RECYCLING_QR, uid, data=identical).status_code == 201
    response = upload(app_client, EWASTE_QR, uid, data=identical)
    assert response.status_code == 409
    assert "already submitted this photo" in response.json()["detail"]


def test_resizing_a_photo_does_not_defeat_duplicate_detection(
    app_client: TestClient, uid: int
):
    """Perceptual hashing is the point: a screenshot or a resize must still match."""
    original = photo(seed=99, size=(800, 600))
    assert upload(app_client, RECYCLING_QR, uid, data=original).status_code == 201

    with Image.open(BytesIO(original)) as img:
        buffer = BytesIO()
        img.resize((400, 300)).save(buffer, format="JPEG", quality=70)

    response = upload(app_client, EWASTE_QR, uid, data=buffer.getvalue())
    assert response.status_code == 409


def test_a_genuinely_different_photo_is_accepted(app_client: TestClient, uid: int):
    assert upload(app_client, RECYCLING_QR, uid, data=photo(seed=1)).status_code == 201
    assert upload(app_client, EWASTE_QR, uid, data=photo(seed=2)).status_code == 201


def test_another_user_may_submit_a_similar_photo(app_client: TestClient, uid: int):
    """Duplicate detection is per user. Two people photographing the same bin is
    normal behaviour and must not be punished."""
    shared = photo(seed=5)
    assert upload(app_client, RECYCLING_QR, uid, data=shared).status_code == 201

    other = app_client.post("/users", json={"username": "hari"}).json()["id"]
    assert upload(app_client, RECYCLING_QR, other, data=shared).status_code == 201


def test_daily_cap_is_enforced(app_client: TestClient, uid: int, monkeypatch):
    monkeypatch.setattr(settings, "MAX_SUBMISSIONS_PER_DAY", 2)
    monkeypatch.setattr(settings, "SUBMISSION_COOLDOWN_MINUTES", 0)

    assert upload(app_client, RECYCLING_QR, uid, data=photo(1)).status_code == 201
    assert upload(app_client, EWASTE_QR, uid, data=photo(2)).status_code == 201

    response = upload(app_client, BOTH_QR, uid, data=photo(3))
    assert response.status_code == 429
    assert "daily limit" in response.json()["detail"]


# --- group attribution ------------------------------------------------------


def test_unknown_group_is_rejected(app_client: TestClient, uid: int):
    response = upload(app_client, RECYCLING_QR, uid, group_id=999)
    assert response.status_code == 404


def test_submitting_to_a_group_you_are_not_in_is_rejected(
    app_client: TestClient, uid: int, session: Session
):
    from app.models import Group

    group = Group(name="Strangers", creator_id=uid, invite_code="ABC123")
    session.add(group)
    session.commit()
    session.refresh(group)

    response = upload(app_client, RECYCLING_QR, uid, group_id=group.id)
    assert response.status_code == 422
    assert "not a member" in response.json()["detail"]


# --- activity reads ---------------------------------------------------------


def test_get_activity_by_id(app_client: TestClient, uid: int):
    activity_id = upload(app_client, RECYCLING_QR, uid).json()["activity"]["id"]
    assert app_client.get(f"/activities/{activity_id}").json()["id"] == activity_id


def test_get_unknown_activity_is_404(app_client: TestClient):
    assert app_client.get("/activities/9999").status_code == 404


def test_user_activity_history_is_newest_first(app_client: TestClient, uid: int):
    upload(app_client, RECYCLING_QR, uid, data=photo(1))
    upload(app_client, EWASTE_QR, uid, data=photo(2))

    body = app_client.get(f"/users/{uid}/activities").json()
    assert len(body) == 2
    assert body[0]["created_at"] >= body[1]["created_at"]


def test_user_activity_history_filters_by_waste_type(app_client: TestClient, uid: int):
    upload(app_client, RECYCLING_QR, uid, data=photo(1))
    upload(app_client, EWASTE_QR, uid, data=photo(2))

    body = app_client.get(
        f"/users/{uid}/activities", params={"waste_type": "e_waste"}
    ).json()
    assert len(body) == 1
    assert body[0]["waste_type"] == "e_waste"


def test_activity_history_for_unknown_user_is_404(app_client: TestClient):
    assert app_client.get("/users/9999/activities").status_code == 404


# --- hashing ----------------------------------------------------------------


def test_dhash_is_stable_for_identical_bytes():
    data = photo(seed=3)
    assert dhash_image(data) == dhash_image(data)


def test_dhash_survives_a_resize():
    original = photo(seed=4, size=(800, 600))
    with Image.open(BytesIO(original)) as img:
        buffer = BytesIO()
        img.resize((400, 300)).save(buffer, format="JPEG", quality=70)

    assert hamming_distance(dhash_image(original), dhash_image(buffer.getvalue())) <= 6


def test_dhash_differs_for_different_images():
    assert hamming_distance(dhash_image(photo(1)), dhash_image(photo(2))) > 6


def test_dhash_returns_none_for_non_image_bytes():
    assert dhash_image(b"not an image") is None


def test_hamming_distance_handles_garbage_safely():
    # A bad stored hash must never look like a match.
    assert hamming_distance("zzzz", "0000") == 64
