import os
import tempfile
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

# Point the app at a throwaway database before app.config is imported.
_tmp = Path(tempfile.mkdtemp())
os.environ["PRELEGAL_DATABASE_URL"] = f"sqlite:///{_tmp / 'test.db'}"

from app.main import app  # noqa: E402


@pytest.fixture(scope="session")
def client():
    with TestClient(app) as c:  # runs the lifespan, which seeds the database
        yield c
