"""Bin discovery and QR resolution."""

import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session

from app.models import Bin
from app.seeds.bins import BIN_SEEDS
from app.utils.geo import bounding_box, format_distance, haversine_m

# NUS Central Library, the origin the demo uses.
NUS_LAT, NUS_LON = 1.2966, 103.7729


@pytest.fixture(name="seeded")
def seeded_fixture(session: Session, client: TestClient) -> TestClient:
    for record in BIN_SEEDS:
        session.add(Bin(**record))
    session.commit()
    return client


# --- geometry ---------------------------------------------------------------


def test_haversine_against_a_known_distance():
    # Kent Ridge MRT to Clementi MRT is roughly 2.9 km apart in a straight line.
    metres = haversine_m(1.2933, 103.7845, 1.3151, 103.7654)
    assert 2500 < metres < 3400


def test_haversine_is_zero_for_the_same_point():
    assert haversine_m(NUS_LAT, NUS_LON, NUS_LAT, NUS_LON) == pytest.approx(0, abs=1e-6)


def test_haversine_is_symmetric():
    there = haversine_m(1.2966, 103.7729, 1.3506, 103.8720)
    back = haversine_m(1.3506, 103.8720, 1.2966, 103.7729)
    assert there == pytest.approx(back)


def test_bounding_box_contains_the_whole_circle():
    """The box must be a superset of the circle, or the SQL prefilter would drop
    bins that should have matched."""
    radius = 2000
    min_lat, max_lat, min_lon, max_lon = bounding_box(NUS_LAT, NUS_LON, radius)

    # The four extreme points of the circle must all sit inside the box.
    for lat, lon in [
        (NUS_LAT + radius / 111_320, NUS_LON),
        (NUS_LAT - radius / 111_320, NUS_LON),
        (NUS_LAT, NUS_LON + radius / 111_320),
        (NUS_LAT, NUS_LON - radius / 111_320),
    ]:
        assert min_lat <= lat <= max_lat
        assert min_lon <= lon <= max_lon


def test_format_distance():
    assert format_distance(12) == "12 m"
    assert format_distance(450.4) == "450 m"
    assert format_distance(1500) == "1.5 km"


# --- nearby search ----------------------------------------------------------


def test_nearby_returns_bins_sorted_by_distance(seeded: TestClient):
    response = seeded.get(
        "/bins/nearby", params={"latitude": NUS_LAT, "longitude": NUS_LON}
    )
    assert response.status_code == 200
    body = response.json()
    assert body, "expected bins near NUS"

    distances = [b["distance_m"] for b in body]
    assert distances == sorted(distances)
    # The library bin is at the search origin, so it must come first.
    assert body[0]["qr_code_id"] == "sg-nus-lib-01"
    assert body[0]["distance_m"] < 5


def test_nearby_includes_display_fields(seeded: TestClient):
    body = seeded.get(
        "/bins/nearby", params={"latitude": NUS_LAT, "longitude": NUS_LON}
    ).json()
    first = body[0]
    assert first["distance_label"]
    assert first["walking_minutes"] >= 1
    assert "accepted_waste_types" in first


def test_radius_is_respected(seeded: TestClient):
    tight = seeded.get(
        "/bins/nearby",
        params={"latitude": NUS_LAT, "longitude": NUS_LON, "radius": 500},
    ).json()
    wide = seeded.get(
        "/bins/nearby",
        params={"latitude": NUS_LAT, "longitude": NUS_LON, "radius": 30000, "limit": 100},
    ).json()

    assert len(tight) < len(wide)
    assert all(b["distance_m"] <= 500 for b in tight)


def test_filter_by_waste_type(seeded: TestClient):
    body = seeded.get(
        "/bins/nearby",
        params={
            "latitude": NUS_LAT,
            "longitude": NUS_LON,
            "radius": 30000,
            "type": "e_waste",
            "limit": 100,
        },
    ).json()
    assert body
    for found in body:
        assert "e_waste" in found["accepted_waste_types"]


def test_a_bin_accepting_both_streams_appears_under_either(seeded: TestClient):
    # Prince George's Park takes recycling and e-waste.
    for waste_type in ["recycling", "e_waste"]:
        body = seeded.get(
            "/bins/nearby",
            params={
                "latitude": NUS_LAT,
                "longitude": NUS_LON,
                "radius": 5000,
                "type": waste_type,
                "limit": 100,
            },
        ).json()
        assert any(b["qr_code_id"] == "sg-nus-pgp-01" for b in body), waste_type


def test_inactive_bins_are_never_returned(seeded: TestClient):
    body = seeded.get(
        "/bins/nearby",
        params={"latitude": NUS_LAT, "longitude": NUS_LON, "radius": 50000, "limit": 100},
    ).json()
    assert all(b["active"] for b in body)
    assert not any(b["qr_code_id"] == "sg-nus-sci-01" for b in body)


def test_nowhere_near_a_bin_returns_an_empty_list_not_an_error(seeded: TestClient):
    # Middle of the Pacific.
    response = seeded.get(
        "/bins/nearby", params={"latitude": 0.0, "longitude": -160.0}
    )
    assert response.status_code == 200
    assert response.json() == []


def test_limit_is_applied(seeded: TestClient):
    body = seeded.get(
        "/bins/nearby",
        params={"latitude": NUS_LAT, "longitude": NUS_LON, "radius": 50000, "limit": 3},
    ).json()
    assert len(body) == 3


def test_invalid_coordinates_are_rejected(seeded: TestClient):
    assert seeded.get("/bins/nearby", params={"latitude": 91, "longitude": 0}).status_code == 422
    assert seeded.get("/bins/nearby", params={"latitude": 0, "longitude": 999}).status_code == 422
    assert seeded.get("/bins/nearby", params={"latitude": 1.3}).status_code == 422


def test_unknown_waste_type_is_rejected(seeded: TestClient):
    response = seeded.get(
        "/bins/nearby",
        params={"latitude": NUS_LAT, "longitude": NUS_LON, "type": "nuclear"},
    )
    assert response.status_code == 422


# --- single bin -------------------------------------------------------------


def test_get_bin_by_id(seeded: TestClient):
    nearby = seeded.get(
        "/bins/nearby", params={"latitude": NUS_LAT, "longitude": NUS_LON}
    ).json()
    bin_id = nearby[0]["id"]
    response = seeded.get(f"/bins/{bin_id}")
    assert response.status_code == 200
    assert response.json()["id"] == bin_id


def test_get_unknown_bin_is_404(seeded: TestClient):
    assert seeded.get("/bins/9999").status_code == 404


# --- QR resolution ----------------------------------------------------------


def test_resolve_qr_code_for_a_recycling_bin(seeded: TestClient):
    response = seeded.get("/recycle/sg-nus-lib-01")
    assert response.status_code == 200
    body = response.json()
    assert body["bin"]["qr_code_id"] == "sg-nus-lib-01"
    assert body["points_available"] == 10
    assert body["submit_path"] == "/recycle/sg-nus-lib-01/submit"
    assert "NUS Central Library" in body["message"]


def test_resolve_qr_code_for_an_ewaste_bin_offers_more_points(seeded: TestClient):
    body = seeded.get("/recycle/sg-nus-eng-ew-01").json()
    assert body["points_available"] == 20
    assert "e-waste" in body["message"]


def test_unknown_qr_code_is_404_with_a_useful_message(seeded: TestClient):
    response = seeded.get("/recycle/not-a-real-code")
    assert response.status_code == 404
    detail = response.json()["detail"]
    assert "not recognised" in detail
    assert "/bins/nearby" in detail


def test_inactive_bin_qr_code_is_refused(seeded: TestClient):
    response = seeded.get("/recycle/sg-nus-sci-01")
    assert response.status_code == 404
    assert "out of service" in response.json()["detail"]


# --- seed data integrity ----------------------------------------------------


def test_seed_qr_codes_are_unique():
    codes = [record["qr_code_id"] for record in BIN_SEEDS]
    assert len(codes) == len(set(codes))


def test_seed_coordinates_are_inside_singapore():
    """A transposed lat/lon would silently put a bin in the sea and break the demo."""
    for record in BIN_SEEDS:
        assert 1.15 <= record["latitude"] <= 1.50, record["name"]
        assert 103.6 <= record["longitude"] <= 104.1, record["name"]


def test_seed_waste_types_are_valid():
    for record in BIN_SEEDS:
        assert record["type"] in {"recycling", "e_waste"}
        assert record["accepted_waste_types"]
        for accepted in record["accepted_waste_types"]:
            assert accepted in {"recycling", "e_waste"}
