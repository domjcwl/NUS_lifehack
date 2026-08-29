"""Groups, membership, leaderboard and the activity feed."""

import random
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image
from sqlmodel import Session

from app.config import settings
from app.models import Bin
from app.seeds.bins import BIN_SEEDS
from app.utils.codes import generate_invite_code, normalise_invite_code

RECYCLING_QR = "sg-nus-lib-01"
EWASTE_QR = "sg-nus-eng-ew-01"
BOTH_QR = "sg-nus-pgp-01"


def photo(seed: int = 0) -> bytes:
    rng = random.Random(seed)
    image = Image.new("RGB", (640, 480))
    image.putdata([(rng.randrange(256),) * 3 for _ in range(640 * 480)])
    buffer = BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


@pytest.fixture(name="app_client")
def app_client_fixture(session: Session, client: TestClient, tmp_path, monkeypatch):
    from app.integrations import storage

    storage.get_storage.cache_clear()
    monkeypatch.setattr(settings, "STORAGE_DIR", str(tmp_path))
    for record in BIN_SEEDS:
        session.add(Bin(**record))
    session.commit()
    yield client
    storage.get_storage.cache_clear()


def make_user(client: TestClient, username: str) -> int:
    return client.post("/users", json={"username": username}).json()["id"]


def make_group(client: TestClient, uid: int, name: str = "Kent Ridge Recyclers") -> dict:
    response = client.post("/groups", json={"name": name}, params={"user_id": uid})
    assert response.status_code == 201, response.text
    return response.json()


def submit(client: TestClient, qr: str, uid: int, seed: int, group_id: int | None = None):
    form = {} if group_id is None else {"group_id": str(group_id)}
    return client.post(
        f"/recycle/{qr}/submit",
        params={"user_id": uid},
        files={"file": ("p.jpg", photo(seed), "image/jpeg")},
        data=form,
    )


# --- creating --------------------------------------------------------------


def test_create_group_makes_the_creator_a_member(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    group = make_group(app_client, uid)

    assert group["name"] == "Kent Ridge Recyclers"
    assert group["creator_id"] == uid
    assert group["member_count"] == 1
    assert group["total_points"] == 0
    assert len(group["invite_code"]) == 6

    members = app_client.get(f"/groups/{group['id']}/members").json()
    assert [m["user_id"] for m in members] == [uid]


def test_create_group_requires_identity(app_client: TestClient):
    assert app_client.post("/groups", json={"name": "Nobody's group"}).status_code == 422


def test_blank_group_name_is_rejected(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    response = app_client.post("/groups", json={"name": "   "}, params={"user_id": uid})
    assert response.status_code == 422


def test_invite_codes_are_unique_across_groups(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    codes = {make_group(app_client, uid, f"Group {i}")["invite_code"] for i in range(8)}
    assert len(codes) == 8


# --- joining ---------------------------------------------------------------


def test_join_by_id(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    joiner = make_user(app_client, "hari")

    response = app_client.post(
        f"/groups/{group['id']}/join", params={"user_id": joiner}
    )
    assert response.status_code == 200
    assert response.json()["member_count"] == 2


def test_join_by_invite_code(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    joiner = make_user(app_client, "hari")

    response = app_client.post(
        "/groups/join",
        json={"invite_code": group["invite_code"]},
        params={"user_id": joiner},
    )
    assert response.status_code == 200
    assert response.json()["id"] == group["id"]


def test_invite_code_is_forgiving_about_case_and_dashes(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    joiner = make_user(app_client, "hari")

    messy = f" {group['invite_code'][:3].lower()}-{group['invite_code'][3:].lower()} "
    response = app_client.post(
        "/groups/join", json={"invite_code": messy}, params={"user_id": joiner}
    )
    assert response.status_code == 200, response.text


def test_unknown_invite_code_is_404(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    response = app_client.post(
        "/groups/join", json={"invite_code": "ZZZZZZ"}, params={"user_id": uid}
    )
    assert response.status_code == 404


def test_joining_twice_is_409(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    response = app_client.post(f"/groups/{group['id']}/join", params={"user_id": owner})
    assert response.status_code == 409
    assert "already a member" in response.json()["detail"]


def test_joining_an_unknown_group_is_404(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    assert app_client.post("/groups/999/join", params={"user_id": uid}).status_code == 404


def test_a_full_group_refuses_new_members(app_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "MAX_GROUP_MEMBERS", 2)
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)

    assert (
        app_client.post(
            f"/groups/{group['id']}/join", params={"user_id": make_user(app_client, "hari")}
        ).status_code
        == 200
    )
    response = app_client.post(
        f"/groups/{group['id']}/join", params={"user_id": make_user(app_client, "zereth")}
    )
    assert response.status_code == 409
    assert "full" in response.json()["detail"]


# --- leaving ---------------------------------------------------------------


def test_leave_group(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    joiner = make_user(app_client, "hari")
    app_client.post(f"/groups/{group['id']}/join", params={"user_id": joiner})

    response = app_client.post(
        f"/groups/{group['id']}/leave", params={"user_id": joiner}
    )
    assert response.status_code == 204
    assert app_client.get(f"/groups/{group['id']}").json()["member_count"] == 1


def test_leaving_a_group_you_are_not_in_is_422(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    outsider = make_user(app_client, "stranger")

    response = app_client.post(
        f"/groups/{group['id']}/leave", params={"user_id": outsider}
    )
    assert response.status_code == 422
    assert "not a member" in response.json()["detail"]


def test_the_creator_may_leave(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    assert (
        app_client.post(f"/groups/{group['id']}/leave", params={"user_id": owner}).status_code
        == 204
    )
    # The group survives, and still records who started it.
    detail = app_client.get(f"/groups/{group['id']}").json()
    assert detail["member_count"] == 0
    assert detail["creator_id"] == owner


def test_leaving_does_not_erase_contributed_history(app_client: TestClient):
    """A group's totals are its record. Leaving must not rewrite it."""
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    submit(app_client, EWASTE_QR, owner, 1, group["id"])

    before = app_client.get(f"/groups/{group['id']}").json()["total_points"]
    app_client.post(f"/groups/{group['id']}/leave", params={"user_id": owner})
    after = app_client.get(f"/groups/{group['id']}").json()

    assert before > 0
    assert after["total_points"] == before
    assert after["activity_count"] == 1


# --- points flowing to the group -------------------------------------------


def test_submitting_with_a_group_credits_the_group(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    group = make_group(app_client, uid)

    response = submit(app_client, EWASTE_QR, uid, 1, group["id"])
    assert response.status_code == 201
    body = response.json()
    assert body["group_total_points"] == 20 + settings.POINTS_FIRST_SUBMISSION_BONUS
    assert app_client.get(f"/groups/{group['id']}").json()["total_points"] == (
        20 + settings.POINTS_FIRST_SUBMISSION_BONUS
    )


def test_submitting_without_a_group_credits_nobody(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    group = make_group(app_client, uid)

    body = submit(app_client, EWASTE_QR, uid, 1).json()
    assert body["group_total_points"] is None
    assert app_client.get(f"/groups/{group['id']}").json()["total_points"] == 0


def test_member_stats_reflect_contributions(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    hari = make_user(app_client, "hari")
    app_client.post(f"/groups/{group['id']}/join", params={"user_id": hari})

    submit(app_client, EWASTE_QR, owner, 1, group["id"])
    submit(app_client, RECYCLING_QR, hari, 2, group["id"])

    members = {m["username"]: m for m in app_client.get(f"/groups/{group['id']}/members").json()}
    assert members["dominic"]["activity_count"] == 1
    assert members["dominic"]["points"] == 20 + settings.POINTS_FIRST_SUBMISSION_BONUS
    assert members["hari"]["points"] == 10 + settings.POINTS_FIRST_SUBMISSION_BONUS


# --- leaderboard -----------------------------------------------------------


def test_leaderboard_ranks_by_points(app_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "POINTS_FIRST_SUBMISSION_BONUS", 0)
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    hari = make_user(app_client, "hari")
    app_client.post(f"/groups/{group['id']}/join", params={"user_id": hari})

    submit(app_client, EWASTE_QR, owner, 1, group["id"])  # 20
    submit(app_client, RECYCLING_QR, hari, 2, group["id"])  # 10

    board = app_client.get(f"/groups/{group['id']}/leaderboard").json()
    assert [(e["rank"], e["username"], e["points"]) for e in board] == [
        (1, "dominic", 20),
        (2, "hari", 10),
    ]


def test_leaderboard_ties_share_a_rank(app_client: TestClient, monkeypatch):
    """Two people on the same score are both second; the next is fourth. Inventing
    an order between equal scores would be visibly unfair."""
    monkeypatch.setattr(settings, "POINTS_FIRST_SUBMISSION_BONUS", 0)
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    hari = make_user(app_client, "hari")
    zereth = make_user(app_client, "zereth")
    for uid in (hari, zereth):
        app_client.post(f"/groups/{group['id']}/join", params={"user_id": uid})

    submit(app_client, EWASTE_QR, owner, 1, group["id"])  # 20
    submit(app_client, RECYCLING_QR, hari, 2, group["id"])  # 10
    submit(app_client, BOTH_QR, zereth, 3, group["id"])  # 10

    board = app_client.get(f"/groups/{group['id']}/leaderboard").json()
    assert [e["rank"] for e in board] == [1, 2, 2]


def test_members_with_no_activity_appear_on_the_leaderboard(app_client: TestClient):
    owner = make_user(app_client, "dominic")
    group = make_group(app_client, owner)
    board = app_client.get(f"/groups/{group['id']}/leaderboard").json()
    assert board[0]["points"] == 0
    assert board[0]["rank"] == 1


# --- activity feed ---------------------------------------------------------


def test_feed_composes_a_readable_line(app_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "POINTS_FIRST_SUBMISSION_BONUS", 0)
    uid = make_user(app_client, "dominic")
    group = make_group(app_client, uid)
    submit(app_client, EWASTE_QR, uid, 1, group["id"])

    item = app_client.get(f"/groups/{group['id']}/activities").json()[0]
    assert item["text"] == "dominic recycled e-waste 🔌 +20 points"
    assert item["bin_name"].startswith("NUS Faculty of Engineering")
    assert item["media_url"].startswith("/media/")


def test_feed_uses_the_display_name_when_set(app_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "POINTS_FIRST_SUBMISSION_BONUS", 0)
    uid = app_client.post(
        "/users", json={"username": "dom", "display_name": "Dominic"}
    ).json()["id"]
    group = make_group(app_client, uid)
    submit(app_client, RECYCLING_QR, uid, 1, group["id"])

    item = app_client.get(f"/groups/{group['id']}/activities").json()[0]
    assert item["text"] == "Dominic recycled ♻️ +10 points"


def test_feed_marks_unverified_submissions_differently(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    group = make_group(app_client, uid)

    blank = BytesIO()
    Image.new("RGB", (640, 480), (200, 200, 200)).save(blank, format="JPEG")
    app_client.post(
        f"/recycle/{RECYCLING_QR}/submit",
        params={"user_id": uid},
        files={"file": ("p.jpg", blank.getvalue(), "image/jpeg")},
        data={"group_id": str(group["id"])},
    )

    item = app_client.get(f"/groups/{group['id']}/activities").json()[0]
    assert item["verification_status"] == "rejected"
    assert "not verified" in item["text"]
    assert "points" not in item["text"]


def test_feed_is_newest_first_and_paginates(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    group = make_group(app_client, uid)
    for index, qr in enumerate([RECYCLING_QR, EWASTE_QR, BOTH_QR]):
        submit(app_client, qr, uid, index, group["id"])

    feed = app_client.get(f"/groups/{group['id']}/activities").json()
    assert len(feed) == 3
    assert feed[0]["activity_id"] > feed[-1]["activity_id"]

    page = app_client.get(
        f"/groups/{group['id']}/activities", params={"limit": 2, "offset": 0}
    ).json()
    assert len(page) == 2
    assert page[0]["activity_id"] == feed[0]["activity_id"]


def test_feed_only_shows_this_group(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    mine = make_group(app_client, uid, "Mine")
    theirs = make_group(app_client, uid, "Theirs")

    submit(app_client, EWASTE_QR, uid, 1, mine["id"])
    assert len(app_client.get(f"/groups/{mine['id']}/activities").json()) == 1
    assert app_client.get(f"/groups/{theirs['id']}/activities").json() == []


# --- lookups ---------------------------------------------------------------


def test_unknown_group_is_404_everywhere(app_client: TestClient):
    for path in ["", "/members", "/leaderboard", "/activities"]:
        assert app_client.get(f"/groups/999{path}").status_code == 404


def test_user_groups_lists_memberships(app_client: TestClient):
    uid = make_user(app_client, "dominic")
    first = make_group(app_client, uid, "First")
    second = make_group(app_client, uid, "Second")
    other_user = make_user(app_client, "hari")
    make_group(app_client, other_user, "Not mine")

    ids = {g["id"] for g in app_client.get(f"/users/{uid}/groups").json()}
    assert ids == {first["id"], second["id"]}


def test_user_groups_for_unknown_user_is_404(app_client: TestClient):
    assert app_client.get("/users/999/groups").status_code == 404


# --- invite codes ----------------------------------------------------------


def test_invite_codes_contain_no_confusable_pair():
    """A code has to survive being read aloud, so no pair of characters that get
    mistaken for each other may both be in the alphabet."""
    from app.utils.codes import _ALPHABET, _CONFUSABLE_PAIRS

    for left, right in _CONFUSABLE_PAIRS:
        assert not (left in _ALPHABET and right in _ALPHABET), f"{left}/{right}"


def test_invite_codes_only_use_the_intended_alphabet():
    from app.utils.codes import _ALPHABET

    codes = "".join(generate_invite_code() for _ in range(200))
    assert set(codes) <= set(_ALPHABET)


def test_normalise_invite_code():
    assert normalise_invite_code(" 7kpq-4m ") == "7KPQ4M"
