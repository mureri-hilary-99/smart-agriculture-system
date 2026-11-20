"""End-to-end tests for every endpoint owned by this service.

Run from `backend/`:
    pytest api_service/tests -q
"""
import pytest
from fastapi.testclient import TestClient

from api_service.infrastructure.container import reset_container
from api_service.main import app

ADMIN_EMAIL = "admin@agri.local"
ADMIN_PASSWORD = "AdminPass123!"


@pytest.fixture()
def client():
    reset_container()
    with TestClient(app) as test_client:
        yield test_client


def register(client, email="farmer@example.com", password="Password123!"):
    response = client.post(
        "/api/v1/auth/register",
        json={"full_name": "Test Farmer", "email": email, "password": password},
    )
    assert response.status_code == 201, response.text
    return response.json()


def login(client, email="farmer@example.com", password="Password123!"):
    response = client.post(
        "/api/v1/auth/login", json={"email": email, "password": password}
    )
    assert response.status_code == 200, response.text
    return response.json()


def headers(token):
    return {"Authorization": f"Bearer {token}"}


def admin_headers(client):
    return headers(login(client, ADMIN_EMAIL, ADMIN_PASSWORD)["access_token"])


def create_farm(client, token):
    response = client.post(
        "/api/v1/farms",
        json={
            "name": "Demo Farm",
            "latitude": 0.02,
            "longitude": 34.75,
            "county": "Kakamega",
        },
        headers=headers(token),
    )
    assert response.status_code == 201, response.text
    return response.json()


# --- Auth and users (#5-#11) -------------------------------------------------

def test_auth_flow(client):
    register(client)
    tokens = login(client)
    token = tokens["access_token"]
    assert tokens["token_type"] == "Bearer"

    me = client.get("/api/v1/auth/me", headers=headers(token))
    assert me.status_code == 200
    assert me.json()["email"] == "farmer@example.com"

    refreshed = client.post(
        "/api/v1/auth/refresh",
        json={"refresh_token": tokens["refresh_token"]},
    )
    assert refreshed.status_code == 200
    assert refreshed.json()["access_token"]

    updated = client.patch(
        "/api/v1/users/me", json={"phone": "+254700000000"}, headers=headers(token)
    )
    assert updated.status_code == 200
    assert updated.json()["phone"] == "+254700000000"

    # Reusing a rotated refresh token must fail.
    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401


def test_admin_user_management(client):
    register(client)
    admin = admin_headers(client)
    listing = client.get("/api/v1/admin/users", headers=admin)
    assert listing.status_code == 200
    assert listing.json()["total"] >= 2

    target = next(
        item for item in listing.json()["items"] if item["email"] == "farmer@example.com"
    )
    promoted = client.patch(
        f"/api/v1/admin/users/{target['id']}",
        json={"role": "extension_officer"},
        headers=admin,
    )
    assert promoted.status_code == 200
    assert promoted.json()["role"] == "extension_officer"


# --- Farms (#12-#15) --------------------------------------------------------

def test_farm_crud(client):
    register(client)
    token = login(client)["access_token"]
    farm = create_farm(client, token)

    listing = client.get("/api/v1/farms", headers=headers(token))
    assert listing.status_code == 200
    assert len(listing.json()) == 1

    detail = client.get(f"/api/v1/farms/{farm['id']}", headers=headers(token))
    assert detail.status_code == 200

    updated = client.patch(
        f"/api/v1/farms/{farm['id']}", json={"name": "New Name"}, headers=headers(token)
    )
    assert updated.status_code == 200
    assert updated.json()["name"] == "New Name"

    missing = client.get("/api/v1/farms/9999", headers=headers(token))
    assert missing.status_code == 404


def test_farm_ownership_is_enforced(client):
    register(client, "owner@example.com")
    owner_token = login(client, "owner@example.com")["access_token"]
    farm = create_farm(client, owner_token)

    register(client, "other@example.com")
    other_token = login(client, "other@example.com")["access_token"]
    denied = client.get(f"/api/v1/farms/{farm['id']}", headers=headers(other_token))
    assert denied.status_code == 403


# --- Weather (#21-#23) ------------------------------------------------------

def test_weather_endpoints(client):
    register(client)
    token = login(client)["access_token"]
    farm = create_farm(client, token)

    current = client.get(
        "/api/v1/weather/current", params={"farm_id": farm["id"]}, headers=headers(token)
    )
    assert current.status_code == 200
    assert current.json()["farm_id"] == farm["id"]

    history = client.get(
        "/api/v1/weather",
        params={"farm_id": farm["id"], "from": "2026-01-01", "to": "2026-12-31"},
        headers=headers(token),
    )
    assert history.status_code == 200
    assert history.json()["total"] >= 1

    refreshed = client.post(
        "/api/v1/weather/refresh",
        json={"farm_id": farm["id"]},
        headers=headers(token),
    )
    assert refreshed.status_code == 200


# --- Recommendations (#24-#27) ---------------------------------------------

def test_recommendation_flow(client):
    register(client)
    token = login(client)["access_token"]
    farm = create_farm(client, token)
    client.get(
        "/api/v1/weather/current", params={"farm_id": farm["id"]}, headers=headers(token)
    )

    created = client.post(
        "/api/v1/recommendations",
        json={
            "farm_id": farm["id"],
            "source": "manual",
            "inputs": {
                "N": 90, "P": 40, "K": 40, "temperature": 25.0,
                "humidity": 65.0, "ph": 6.5, "rainfall": 800.0,
            },
        },
        headers=headers(token),
    )
    assert created.status_code == 201, created.text
    body = created.json()
    assert body["status"] == "ok"
    assert len(body["top_recommendations"]) == 3
    assert body["model_version"]

    latest = client.get(
        "/api/v1/recommendations/latest",
        params={"farm_id": farm["id"]},
        headers=headers(token),
    )
    assert latest.status_code == 200
    assert latest.json()["id"] == body["id"]

    listing = client.get(
        "/api/v1/recommendations",
        params={"farm_id": farm["id"]},
        headers=headers(token),
    )
    assert listing.status_code == 200
    assert listing.json()["total"] == 1

    detail = client.get(
        f"/api/v1/recommendations/{body['id']}", headers=headers(token)
    )
    assert detail.status_code == 200


def test_recommendation_requires_inputs(client):
    register(client)
    token = login(client)["access_token"]
    farm = create_farm(client, token)
    response = client.post(
        "/api/v1/recommendations",
        json={"farm_id": farm["id"], "source": "manual", "inputs": {"ph": 6.5}},
        headers=headers(token),
    )
    assert response.status_code == 422
    assert "Missing required inputs" in response.json()["detail"]


# --- Crops (#28-#30) --------------------------------------------------------

def test_crop_catalogue(client):
    register(client)
    token = login(client)["access_token"]

    listing = client.get("/api/v1/crops", headers=headers(token))
    assert listing.status_code == 200
    assert any(crop["code"] == "maize" for crop in listing.json())

    detail = client.get("/api/v1/crops/maize", headers=headers(token))
    assert detail.status_code == 200

    filtered = client.get(
        "/api/v1/crops", params={"q": "bean"}, headers=headers(token)
    )
    assert filtered.status_code == 200

    admin = admin_headers(client)
    created = client.post(
        "/api/v1/crops",
        json={"code": "millet", "name": "Millet", "local_name": "Ulezi"},
        headers=admin,
    )
    assert created.status_code == 201

    updated = client.patch(
        "/api/v1/crops/millet", json={"is_active": False}, headers=admin
    )
    assert updated.status_code == 200
    assert updated.json()["is_active"] is False

    deleted = client.delete("/api/v1/crops/millet", headers=admin)
    assert deleted.status_code == 204

    duplicate = client.post(
        "/api/v1/crops", json={"code": "maize", "name": "Maize"}, headers=admin
    )
    assert duplicate.status_code == 409


# --- Admin, datasets, audit, model info (#31-#33, #36) ---------------------

def test_admin_datasets_params_audit_and_model_info(client):
    admin = admin_headers(client)

    params = client.get("/api/v1/admin/system-params", headers=admin)
    assert params.status_code == 200
    assert any(item["key"] == "min_confidence" for item in params.json())

    changed = client.patch(
        "/api/v1/admin/system-params", json={"params": {"min_confidence": 0.7}}, headers=admin
    )
    assert changed.status_code == 200

    datasets = client.get("/api/v1/admin/datasets", headers=admin)
    assert datasets.status_code == 200

    uploaded = client.post(
        "/api/v1/admin/datasets",
        json={"name": "Crop_recommendation.csv", "file_uri": "s3://datasets/crop.csv"},
        headers=admin,
    )
    assert uploaded.status_code == 201

    audit = client.get("/api/v1/audit-logs", headers=admin)
    assert audit.status_code == 200
    assert audit.json()["total"] >= 1

    info = client.get("/api/v1/model/info", headers=admin)
    assert info.status_code == 200
    assert "classes" in info.json()
    assert "features" in info.json()


# --- Reports (#34-#35) ------------------------------------------------------

def test_reports(client):
    register(client)
    token = login(client)["access_token"]
    farm = create_farm(client, token)
    client.get(
        "/api/v1/weather/current", params={"farm_id": farm["id"]}, headers=headers(token)
    )
    client.post(
        "/api/v1/recommendations",
        json={
            "farm_id": farm["id"],
            "source": "manual",
            "inputs": {
                "N": 90, "P": 40, "K": 40, "temperature": 25.0,
                "humidity": 65.0, "ph": 6.5, "rainfall": 800.0,
            },
        },
        headers=headers(token),
    )

    summary = client.get(
        "/api/v1/reports/summary", params={"farm_id": farm["id"]}, headers=headers(token)
    )
    assert summary.status_code == 200
    assert summary.json()["readings_count"] >= 1

    exported = client.get(
        "/api/v1/reports/export", params={"farm_id": farm["id"]}, headers=headers(token)
    )
    assert exported.status_code == 200
    assert "recommended_crop" in exported.text


# --- Error handling ---------------------------------------------------------

def test_error_handling(client):
    unauthenticated = client.get("/api/v1/farms")
    assert unauthenticated.status_code == 401
    assert unauthenticated.json()["code"] == "unauthorized"

    register(client)
    token = login(client)["access_token"]
    forbidden = client.get("/api/v1/admin/users", headers=headers(token))
    assert forbidden.status_code == 403

    invalid = client.post(
        "/api/v1/farms",
        json={"name": "Bad", "latitude": 999, "longitude": 0},
        headers=headers(token),
    )
    assert invalid.status_code == 422
    assert isinstance(invalid.json()["detail"], list)

    duplicate = client.post(
        "/api/v1/auth/register",
        json={
            "full_name": "Test Farmer",
            "email": "farmer@example.com",
            "password": "Password123!",
        },
    )
    assert duplicate.status_code == 409
