import os
from pathlib import Path

from dotenv import load_dotenv

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_DIR = BACKEND_DIR.parent

# Local secrets such as ANTHROPIC_API_KEY live in backend/.env (git-ignored).
# Variables already set in the environment take precedence.
load_dotenv(BACKEND_DIR / ".env")

# Temporary database: a local SQLite file, rebuilt from the templates on every startup.
DATABASE_URL = os.environ.get("PRELEGAL_DATABASE_URL", f"sqlite:///{BACKEND_DIR / 'prelegal.db'}")

TEMPLATES_DIR = Path(os.environ.get("PRELEGAL_TEMPLATES_DIR", REPO_DIR / "templates"))
CATALOG_FILE = Path(os.environ.get("PRELEGAL_CATALOG_FILE", REPO_DIR / "catalog.json"))
# The supported document types and their cover page fields.
DOCUMENTS_FILE = Path(os.environ.get("PRELEGAL_DOCUMENTS_FILE", REPO_DIR / "documents.json"))

CLAUDE_MODEL = os.environ.get("PRELEGAL_CLAUDE_MODEL", "claude-opus-5-5")


def has_anthropic_credentials() -> bool:
    return bool(os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"))
