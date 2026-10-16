from collections.abc import Iterator
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import MetaData, create_engine, event, make_url
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import BACKEND_DIR, DATABASE_URL


class Base(DeclarativeBase):
    # Named constraints, so migrations can alter them (SQLite needs names for batch mode).
    metadata = MetaData(
        naming_convention={
            "ix": "ix_%(column_0_label)s",
            "uq": "uq_%(table_name)s_%(column_0_name)s",
            "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
            "pk": "pk_%(table_name)s",
        }
    )


engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(engine)

if engine.dialect.name == "sqlite":

    @event.listens_for(engine, "connect")
    def _enable_sqlite_foreign_keys(dbapi_connection, _):
        # SQLite ignores foreign keys (and ON DELETE CASCADE) unless asked per connection.
        dbapi_connection.execute("PRAGMA foreign_keys=ON")


def migrate() -> None:
    """Bring the database schema up to date by running any pending Alembic migrations."""
    url = make_url(DATABASE_URL)
    if url.get_backend_name() == "sqlite" and url.database and url.database != ":memory:":
        Path(url.database).parent.mkdir(parents=True, exist_ok=True)
    config = Config(BACKEND_DIR / "alembic.ini")
    config.attributes["configure_logger"] = False  # keep uvicorn's logging
    command.upgrade(config, "head")


def get_session() -> Iterator[Session]:
    """FastAPI dependency that yields a database session per request."""
    with SessionLocal() as session:
        yield session
