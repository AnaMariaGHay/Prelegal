from contextlib import asynccontextmanager
from datetime import date
from functools import cache
from typing import Annotated

import anthropic
from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.chat import GREETING, ChatError, ChatRequest, ChatResponse, run_chat_turn
from app.config import CATALOG_FILE, TEMPLATES_DIR, has_anthropic_credentials
from app.db import engine, get_session
from app.documents import DocumentSpec, load_specs
from app.models import Template
from app.seed import reset_and_seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    reset_and_seed(engine, CATALOG_FILE, TEMPLATES_DIR)
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


@app.get("/api/chat")
def chat_start() -> dict[str, str]:
    """The assistant's opening message, shown before the user's first turn."""
    return {"greeting": GREETING}


@app.post("/api/chat")
async def chat(request: ChatRequest, session: SessionDep, claude: ClaudeDep) -> ChatResponse:
    """One chat turn: Claude replies, and chooses the document or fills in any fields the user gave."""
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
        return await run_chat_turn(claude, request, standard_terms, date.today())
    except ChatError as e:
        raise HTTPException(status_code=e.status_code, detail=e.message) from e
