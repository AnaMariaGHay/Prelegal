"""Email and password accounts, with server-side login sessions kept in an httpOnly cookie."""

import hashlib
import re
import secrets
from datetime import timedelta
from typing import Annotated

from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerifyMismatchError
from fastapi import Cookie, Depends, HTTPException, Response
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.config import SECURE_COOKIES, SESSION_DAYS
from app.db import get_session
from app.models import AuthSession, User, utcnow

COOKIE_NAME = "prelegal_session"

_hasher = PasswordHasher()
# Verified against when the email is unknown, so a login takes as long either way and
# doesn't reveal which emails have accounts.
_DUMMY_HASH = _hasher.hash(secrets.token_hex(16))

# Deliberately loose: one @, something on each side, a dot in the domain, no spaces.
_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class Credentials(BaseModel):
    email: str = Field(max_length=320)
    password: str = Field(max_length=256)

    @field_validator("email")
    @classmethod
    def normalize_email(cls, value: str) -> str:
        value = value.strip().lower()
        if not _EMAIL.match(value):
            raise ValueError("Enter a valid email address.")
        return value


class SignupRequest(Credentials):
    password: str = Field(min_length=8, max_length=256)


class UserOut(BaseModel):
    id: str
    email: str


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def hash_password(password: str) -> str:
    return _hasher.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _hasher.verify(password_hash, password)
    except (VerifyMismatchError, InvalidHashError):
        return False


def authenticate(db: Session, email: str, password: str) -> User | None:
    user = db.scalar(select(User).where(User.email == email))
    if user is None:
        verify_password(_DUMMY_HASH, password)
        return None
    return user if verify_password(user.password_hash, password) else None


def start_session(db: Session, user: User, response: Response) -> None:
    """Create a login session for `user` and set its cookie on `response`."""
    token = secrets.token_urlsafe(32)
    expires = utcnow() + timedelta(days=SESSION_DAYS)
    db.add(AuthSession(token_hash=_token_hash(token), user_id=user.id, expires_at=expires))
    # Tidy up this user's expired sessions while we're here.
    db.execute(delete(AuthSession).where(AuthSession.user_id == user.id, AuthSession.expires_at < utcnow()))
    db.commit()
    response.set_cookie(
        COOKIE_NAME,
        token,
        max_age=SESSION_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=SECURE_COOKIES,
        samesite="lax",
        path="/",
    )


def end_session(db: Session, token: str | None, response: Response) -> None:
    if token:
        db.execute(delete(AuthSession).where(AuthSession.token_hash == _token_hash(token)))
        db.commit()
    response.delete_cookie(COOKIE_NAME, path="/", httponly=True, secure=SECURE_COOKIES, samesite="lax")


def current_user(
    db: Annotated[Session, Depends(get_session)],
    prelegal_session: Annotated[str | None, Cookie()] = None,
) -> User:
    """FastAPI dependency: the logged-in user, or a 401 if there isn't one."""
    if prelegal_session:
        session = db.get(AuthSession, _token_hash(prelegal_session))
        if session is not None and session.expires_at > utcnow():
            user = db.get(User, session.user_id)
            if user is not None:
                return user
    raise HTTPException(status_code=401, detail="Please log in to continue.")


CurrentUser = Annotated[User, Depends(current_user)]
