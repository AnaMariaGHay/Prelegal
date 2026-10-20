import os
import tempfile
from pathlib import Path
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient

# Point the app at a throwaway database before app.config is imported.
_tmp = Path(tempfile.mkdtemp())
os.environ["PRELEGAL_DATABASE_URL"] = f"sqlite:///{(_tmp / 'test.db').as_posix()}"

from app.main import app  # noqa: E402

PASSWORD = "correct horse battery"


@pytest.fixture
def client():
    # A fresh client per test, so login cookies don't leak between tests. Starting it runs
    # the lifespan, which migrates the database and refreshes the templates.
    with TestClient(app) as c:
        yield c


def signup(client: TestClient, email: str | None = None) -> dict:
    """Create an account (logged in on `client`) and return the user."""
    response = client.post("/api/auth/signup", json={"email": email or f"{uuid4().hex}@example.com", "password": PASSWORD})
    assert response.status_code == 201, response.text
    return response.json()


@pytest.fixture
def user_client(client):
    """A client logged in as a new user."""
    signup(client)
    return client
