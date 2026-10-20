"""Alembic environment: migrates the database configured in app.config.

Run `uv run alembic upgrade head` to migrate by hand. The backend also migrates on
startup. After changing app/models.py, generate a migration with
`uv run alembic revision --autogenerate -m "describe the change"` and review it.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app import models  # noqa: F401  (registers the tables on Base.metadata)
from app.config import DATABASE_URL
from app.db import Base

config = context.config
# Keep the app's logging when migrations run on startup; only configure it from the
# ini file when Alembic runs from the command line.
if config.config_file_name is not None and config.attributes.get("configure_logger", True):
    fileConfig(config.config_file_name)

config.set_main_option("sqlalchemy.url", DATABASE_URL.replace("%", "%%"))
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(url=DATABASE_URL, target_metadata=target_metadata, literal_binds=True, render_as_batch=True)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(config.get_section(config.config_ini_section, {}), prefix="sqlalchemy.", poolclass=pool.NullPool)
    with connectable.connect() as connection:
        # Batch mode lets ALTER TABLE migrations work on SQLite.
        context.configure(connection=connection, target_metadata=target_metadata, render_as_batch=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
