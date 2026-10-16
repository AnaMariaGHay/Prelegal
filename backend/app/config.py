import os
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# Temporary database: a local SQLite file, rebuilt from the templates on every startup.
DATABASE_URL = os.environ.get("PRELEGAL_DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'prelegal.db'}")

TEMPLATES_DIR = Path(os.environ.get("PRELEGAL_TEMPLATES_DIR", REPO_DIR / "templates"))
CATALOG_FILE = Path(os.environ.get("PRELEGAL_CATALOG_FILE", REPO_DIR / "catalog.json"))
