from uuid import uuid4

from fastapi.testclient import TestClient

from app.auth import COOKIE_NAME
from app.main import app
from tests.conftest import PASSWORD, signup


def test_signup_logs_in(client):
    user = signup(client, "Ada@Example.com ")

    assert user["email"] == "ada@example.com"  # normalized
    cookie = client.cookies.get(COOKIE_NAME)
    assert cookie and len(cookie) > 30
    assert client.get("/api/auth/me").json() == user


def test_session_cookie_is_http_only(client):
    response = client.post("/api/auth/signup", json={"email": f"{uuid4().hex}@example.com", "password": PASSWORD})
    set_cookie = response.headers["set-cookie"].lower()
    assert "httponly" in set_cookie and "samesite=lax" in set_cookie and "path=/" in set_cookie


def test_signup_validation(client):
    assert client.post("/api/auth/signup", json={"email": "not-an-email", "password": PASSWORD}).status_code == 422
    assert client.post("/api/auth/signup", json={"email": "a@example.com", "password": "short"}).status_code == 422


def test_duplicate_email_is_rejected(client):
    email = f"{uuid4().hex}@example.com"
    signup(client, email)
    response = client.post("/api/auth/signup", json={"email": email.upper(), "password": PASSWORD})
    assert response.status_code == 409
    assert "already exists" in response.json()["detail"]


def test_login_and_logout(client):
    email = f"{uuid4().hex}@example.com"
    signup(client, email)
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401

    assert client.post("/api/auth/login", json={"email": email, "password": "wrong password"}).status_code == 401
    response = client.post("/api/auth/login", json={"email": email, "password": PASSWORD})
    assert response.status_code == 200
    assert client.get("/api/auth/me").json()["email"] == email


def test_logout_revokes_the_session_server_side(client):
    signup(client)
    token = client.cookies.get(COOKIE_NAME)
    client.post("/api/auth/logout")

    # Even if a copy of the old cookie is replayed, it no longer works.
    with TestClient(app) as other:
        other.cookies.set(COOKIE_NAME, token)
        assert other.get("/api/auth/me").status_code == 401


def test_unknown_email_and_bad_cookie_are_401(client):
    assert client.post("/api/auth/login", json={"email": "nobody@example.com", "password": PASSWORD}).status_code == 401
    client.cookies.set(COOKIE_NAME, "made-up")
    assert client.get("/api/auth/me").status_code == 401


def test_accounts_survive_a_restart():
    email = f"{uuid4().hex}@example.com"
    with TestClient(app) as first:
        signup(first, email)
    # A new client runs startup again (migrations and template refresh) on the same database.
    with TestClient(app) as second:
        assert second.post("/api/auth/login", json={"email": email, "password": PASSWORD}).status_code == 200
        assert len(second.get("/api/templates").json()) == 12
