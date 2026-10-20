from contextlib import asynccontextmanager
from datetime import date
from functools import cache
from typing import Annotated

import anthropic
from fastapi import Cookie, Depends, FastAPI, HTTPException, Response
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app import drafts
from app.auth import (
    Credentials,
    CurrentUser,
    SignupRequest,
    UserOut,
    authenticate,
    end_session,
    hash_password,
    start_session,
)
from app.chat import GREETING, ChatError, ChatRequest, ChatResponse, run_chat_turn
from app.config import CATALOG_FILE, TEMPLATES_DIR, has_anthropic_credentials
from app.db import engine, get_session, migrate
from app.documents import DocumentSpec, load_specs
from app.models import Template, User
from app.seed import refresh_templates


@asynccontextmanager
async def lifespan(_: FastAPI):
    migrate()
    refresh_templates(engine, CATALOG_FILE, TEMPLATES_DIR)
    yield


app = FastAPI(title="Prelegal API", lifespan=lifespan)

SessionDep = Annotated[Session, Depends(get_session)]


@cache
def get_claude() -> anthropic.AsyncAnthropic:
    """FastAPI dependency for the shared Claude client (overridden in tests)."""
    return anthropic.AsyncAnthropic()


ClaudeDep = Annotated[anthropic.AsyncAnthropic, Depends(get_claude)]


class TemplateSummary(BaseModel):
    slug: str
    name: str
    description: str
    filename: str


class TemplateDetail(TemplateSummary):
    content: str


@app.get("/api/health")
def health(session: SessionDep) -> dict[str, str]:
    session.execute(select(1))
    return {"status": "ok"}


@app.get("/api/templates")
def list_templates(session: SessionDep) -> list[TemplateSummary]:
    templates = session.scalars(select(Template).order_by(Template.name))
    return [TemplateSummary.model_validate(t, from_attributes=True) for t in templates]


@app.get("/api/templates/{slug}")
def get_template(slug: str, session: SessionDep) -> TemplateDetail:
    template = session.get(Template, slug)
    if template is None:
        raise HTTPException(status_code=404, detail=f"Template '{slug}' not found")
    return TemplateDetail.model_validate(template, from_attributes=True)


class DocumentDetail(DocumentSpec):
    content: str  # the Standard Terms markdown


@app.get("/api/documents")
def list_documents() -> list[DocumentSpec]:
    """The supported document types, with the fields on each one's cover page."""
    return list(load_specs().values())


@app.get("/api/documents/{slug}")
def get_document(slug: str, session: SessionDep) -> DocumentDetail:
    """One document type's spec plus its Standard Terms."""
    spec = load_specs().get(slug)
    template = session.get(Template, slug)
    if spec is None or template is None:
        raise HTTPException(status_code=404, detail=f"Document '{slug}' not found")
    return DocumentDetail(**spec.model_dump(), content=template.content)


# --- Accounts ---


@app.post("/api/auth/signup", status_code=201)
def signup(credentials: SignupRequest, response: Response, session: SessionDep) -> UserOut:
    """Create an account and log it in."""
    user = User(email=credentials.email, password_hash=hash_password(credentials.password))
    session.add(user)
    try:
        session.flush()
    except IntegrityError:
        session.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists. Try logging in.")
    start_session(session, user, response)
    return UserOut(id=user.id, email=user.email)


@app.post("/api/auth/login")
def login(credentials: Credentials, response: Response, session: SessionDep) -> UserOut:
    user = authenticate(session, credentials.email, credentials.password)
    if user is None:
        raise HTTPException(status_code=401, detail="Incorrect email or password.")
    start_session(session, user, response)
    return UserOut(id=user.id, email=user.email)


@app.post("/api/auth/logout", status_code=204)
def logout(response: Response, session: SessionDep, prelegal_session: Annotated[str | None, Cookie()] = None) -> None:
    end_session(session, prelegal_session, response)


@app.get("/api/auth/me")
def me(user: CurrentUser) -> UserOut:
    return UserOut(id=user.id, email=user.email)


# --- The logged-in user's documents ---


@app.get("/api/drafts")
def list_drafts(user: CurrentUser, session: SessionDep) -> list[drafts.DraftSummary]:
    """The user's documents, most recently updated first."""
    return [drafts.summarize(d) for d in drafts.list_for(session, user)]


@app.get("/api/drafts/{draft_id}")
def get_draft(draft_id: str, user: CurrentUser, session: SessionDep) -> drafts.DraftDetail:
    return drafts.detail(drafts.get_owned(session, user, draft_id))


@app.delete("/api/drafts/{draft_id}", status_code=204)
def delete_draft(draft_id: str, user: CurrentUser, session: SessionDep) -> None:
    session.delete(drafts.get_owned(session, user, draft_id))
    session.commit()


# --- AI chat ---


@app.get("/api/chat")
def chat_start() -> dict[str, str]:
    """The assistant's opening message, shown before the user's first turn."""
    return {"greeting": GREETING}


@app.post("/api/chat")
async def chat(request: ChatRequest, user: CurrentUser, session: SessionDep, claude: ClaudeDep) -> ChatResponse:
    """One chat turn: Claude replies, and chooses the document or fills in any fields the user gave.

    The conversation and document are saved to the user's draft (created on the first turn).
    """
    draft = drafts.get_owned(session, user, request.draft_id) if request.draft_id else None
    if not has_anthropic_credentials():
        raise HTTPException(
            status_code=503,
            detail="The AI chat isn't set up yet: add ANTHROPIC_API_KEY to backend/.env and restart the backend.",
        )
    standard_terms = None
    if request.document.type is not None:
        template = session.get(Template, request.document.type)
        if request.document.type not in load_specs() or template is None:
            raise HTTPException(status_code=422, detail=f"Unknown document type '{request.document.type}'.")
        standard_terms = template.content
    try:
        result = await run_chat_turn(claude, request, standard_terms, date.today())
    except ChatError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e

    history = [*request.messages, drafts.ChatMessage(role="assistant", content=result.reply)]
    draft = drafts.save(session, user, draft, result.document, history)
    return result.model_copy(update={"draft_id": draft.id})
