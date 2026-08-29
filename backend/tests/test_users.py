"""User creation and identity resolution.

There is no authentication: a caller says who it is with `?user_id=` or `X-User-Id`.
"""

from fastapi.testclient import TestClient


def test_create_user_with_only_a_username(client: TestClient):
    response = client.post("/users", json={"username": "zereth"})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id"]
    assert body["username"] == "zereth"
    # display_name falls back to the username so the activity feed always has a label.
    assert body["display_name"] == "zereth"
    assert body["email"] is None


def test_create_user_with_email_and_display_name(client: TestClient):
    response = client.post(
        "/users",
        json={
            "username": "hari",
            "email": "hari@example.com",
            "display_name": "Hari K",
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "hari@example.com"
    assert body["display_name"] == "Hari K"


def test_creating_several_users_in_a_row_works(client: TestClient):
    """The bug that started this: Swagger's pre-filled example could only ever be
    submitted once, which looked like registration being broken."""
    for name in ["dominic", "hari", "zereth", "inferno"]:
        assert client.post("/users", json={"username": name}).status_code == 201
    assert len(client.get("/users").json()) == 4


def test_duplicate_username_is_rejected_case_insensitively(
    client: TestClient, user: dict
):
    response = client.post("/users", json={"username": "DOMINIC"})
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert "already taken" in detail
    # The message has to say what to do next, not just that something went wrong.
    assert "different" in detail.lower()


def test_duplicate_email_is_rejected(client: TestClient):
    client.post("/users", json={"username": "alice", "email": "shared@example.com"})
    response = client.post(
        "/users", json={"username": "bob", "email": "SHARED@example.com"}
    )
    assert response.status_code == 409
    assert "email" in response.json()["detail"].lower()


def test_several_users_may_omit_the_email(client: TestClient):
    # A unique index must not treat two missing emails as a collision.
    assert client.post("/users", json={"username": "alice"}).status_code == 201
    assert client.post("/users", json={"username": "bob"}).status_code == 201


def test_username_charset_is_enforced(client: TestClient):
    response = client.post("/users", json={"username": "bad name!"})
    assert response.status_code == 422


def test_username_too_short(client: TestClient):
    assert client.post("/users", json={"username": "ab"}).status_code == 422


def test_bad_email_is_rejected(client: TestClient):
    response = client.post(
        "/users", json={"username": "bademail", "email": "not-an-email"}
    )
    assert response.status_code == 422


def test_list_and_get_user(client: TestClient, user: dict):
    assert client.get("/users").json()[0]["username"] == "dominic"
    assert client.get(f"/users/{user['id']}").json()["username"] == "dominic"


def test_get_unknown_user_is_404(client: TestClient):
    assert client.get("/users/9999").status_code == 404


def test_identity_via_query_parameter(client: TestClient, user: dict):
    response = client.get("/me", params={"user_id": user["id"]})
    assert response.status_code == 200
    assert response.json()["username"] == "dominic"


def test_identity_via_header(client: TestClient, user: dict):
    response = client.get("/me", headers=user["headers"])
    assert response.status_code == 200
    assert response.json()["username"] == "dominic"


def test_query_parameter_wins_over_header(client: TestClient, user: dict):
    second = client.post("/users", json={"username": "hari"}).json()
    response = client.get(
        "/me", params={"user_id": second["id"]}, headers=user["headers"]
    )
    assert response.json()["username"] == "hari"


def test_missing_identity_explains_what_to_do(client: TestClient):
    response = client.get("/me")
    assert response.status_code == 422
    detail = response.json()["detail"]
    assert "user_id" in detail
    assert "POST /users" in detail


def test_unknown_identity_is_404(client: TestClient):
    response = client.get("/me", params={"user_id": 4242})
    assert response.status_code == 404
    assert "4242" in response.json()["detail"]


def test_no_endpoint_requires_authorization(client: TestClient):
    """Nothing in the OpenAPI schema should carry a security requirement."""
    spec = client.get("/openapi.json").json()
    assert "securitySchemes" not in spec.get("components", {})
    for path, operations in spec["paths"].items():
        for method, operation in operations.items():
            assert "security" not in operation, f"{method.upper()} {path} wants auth"


def test_timestamps_are_serialised_as_explicit_utc(client: TestClient, user: dict):
    """A naive timestamp would be read as local time by the browser, putting every
    activity eight hours out in Singapore. The offset must always be explicit."""
    created_at = user["user"]["created_at"]
    assert created_at.endswith("Z") or "+00:00" in created_at, created_at


def test_health_and_root(client: TestClient):
    assert client.get("/health").json() == {"status": "ok"}
    assert client.get("/").json()["status"] == "ok"
