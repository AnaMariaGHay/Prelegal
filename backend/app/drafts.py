"""A user's saved documents ("drafts"): each one's document state and the chat behind it."""

from datetime import UTC, datetime

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chat import ChatMessage
from app.documents import CamelModel, DocumentState, load_specs, missing_fields
from app.models import Draft, User


class DraftSummary(CamelModel):
    id: str
    type: str | None
    title: str
    missing_count: int | None  # None until a document type is chosen
    updated_at: datetime


class DraftDetail(CamelModel):
    id: str
    document: DocumentState
    messages: list[ChatMessage]
    updated_at: datetime


def title_for(document: DocumentState) -> str:
    """E.g. "Mutual NDA: Acme Inc. & Globex Corp", from the document type and party companies."""
    spec = load_specs().get(document.type) if document.type else None
    if spec is None:
        return "New document"
    companies = " & ".join(p.company for p in document.parties if p.company.strip())
    name = spec.short_name or spec.name
    return f"{name}: {companies}" if companies else name


def summarize(draft: Draft) -> DraftSummary:
    document = DocumentState.model_validate(draft.document)
    spec = load_specs().get(document.type) if document.type else None
    return DraftSummary(
        id=draft.id,
        type=document.type,
        title=title_for(document),
        missing_count=len(missing_fields(document, spec)) if spec else None,
        updated_at=draft.updated_at.replace(tzinfo=UTC),  # stored as naive UTC
    )


def detail(draft: Draft) -> DraftDetail:
    return DraftDetail(
        id=draft.id,
        document=DocumentState.model_validate(draft.document),
        messages=[ChatMessage.model_validate(m) for m in draft.messages],
        updated_at=draft.updated_at.replace(tzinfo=UTC),  # stored as naive UTC
    )


def list_for(db: Session, user: User) -> list[Draft]:
    return list(db.scalars(select(Draft).where(Draft.user_id == user.id).order_by(Draft.updated_at.desc())))


def get_owned(db: Session, user: User, draft_id: str) -> Draft:
    """The user's draft with this id. Someone else's draft is a 404, the same as a missing one."""
    draft = db.get(Draft, draft_id)
    if draft is None or draft.user_id != user.id:
        raise HTTPException(status_code=404, detail="Document not found.")
    return draft


def save(db: Session, user: User, draft: Draft | None, document: DocumentState, messages: list[ChatMessage]) -> Draft:
    """Store the document and conversation, creating the draft on its first save."""
    if draft is None:
        draft = Draft(user_id=user.id)
        db.add(draft)
    draft.document = document.model_dump(by_alias=True)
    draft.messages = [m.model_dump() for m in messages]
    db.commit()
    return draft
