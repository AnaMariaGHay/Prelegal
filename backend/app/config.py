import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# Local secrets such as ANTHROPIC_API_KEY live in backend/.env (git-ignored).
# Variables already set in the environment take precedence.
load_dotenv(BACKEND_DIR / ".env")

# Persistent database: a local SQLite file by default. Any SQLAlchemy URL works, e.g.
# postgresql+psycopg://user:pass@host/prelegal (with the driver installed). The schema is
# migrated on startup (see migrations/).
DATA_DIR = BACKEND_DIR / "data"
DATABASE_URL = os.environ.get("PRELEGAL_DATABASE_URL", f"sqlite:///{(DATA_DIR / 'prelegal.db').as_posix()}")

# Login sessions last this long. Set PRELEGAL_SECURE_COOKIES=true when serving over HTTPS,
# so the session cookie is never sent over plain HTTP.
SESSION_DAYS = int(os.environ.get("PRELEGAL_SESSION_DAYS", "30"))
SECURE_COOKIES = os.environ.get("PRELEGAL_SECURE_COOKIES", "false").lower() in ("1", "true", "yes")

TEMPLATES_DIR = Path(os.environ.get("PRELEGAL_TEMPLATES_DIR", REPO_DIR / "templates"))
CATALOG_FILE = Path(os.environ.get("PRELEGAL_CATALOG_FILE", REPO_DIR / "catalog.json"))
# The supported document types and their cover page fields.
DOCUMENTS_FILE = Path(os.environ.get("PRELEGAL_DOCUMENTS_FILE", REPO_DIR / "documents.json"))

CLAUDE_MODEL = os.environ.get("PRELEGAL_CLAUDE_MODEL", "claude-opus-5-5")


def has_anthropic_credentials() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
