from datetime import UTC, datetime
from typing import Any
from uuid import uuid4

from sqlalchemy import JSON, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


def utcnow() -> datetime:
    """The current time in UTC, without tzinfo, so it compares the same way in SQLite and Postgres."""
    return datetime.now(UTC).replace(tzinfo=None)


def new_id() -> str:
    return uuid4().hex


class Template(Base):
    """A legal agreement template from templates/, as listed in catalog.json.

    Refreshed from the files on every startup, so editing a template only needs a restart.
    """

    __tablename__ = "templates"

    # URL-friendly id derived from the filename, e.g. "Mutual-NDA.md" -> "mutual-nda".
    slug: Mapped[str] = mapped_column(String(100), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    filename: Mapped[str] = mapped_column(String(200))
    content: Mapped[str] = mapped_column(Text)


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    email: Mapped[str] = mapped_column(String(320), unique=True)  # stored lowercased
    password_hash: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(default=utcnow)


class AuthSession(Base):
    """A logged-in browser. The cookie holds a random token; only its SHA-256 hash is stored."""

    __tablename__ = "sessions"

    token_hash: Mapped[str] = mapped_column(String(64), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    expires_at: Mapped[datetime]


class Draft(Base):
    """A document a user is creating: its current state and the chat that produced it."""

    __tablename__ = "drafts"

    id: Mapped[str] = mapped_column(String(32), primary_key=True, default=new_id)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    document: Mapped[dict[str, Any]] = mapped_column(JSON)  # a DocumentState, camelCase
    messages: Mapped[list[dict[str, str]]] = mapped_column(JSON)
    created_at: Mapped[datetime] = mapped_column(default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(default=utcnow, onupdate=utcnow)
