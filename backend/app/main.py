from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import Depends, FastAPI, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import CATALOG_FILE, TEMPLATES_DIR
from app.db import engine, get_session
from app.models import Template
from app.seed import reset_and_seed


@asynccontextmanager
async def lifespan(_: FastAPI):
    reset_and_seed(engine, CATALOG_FILE, TEMPLATES_DIR)
    yield


app = FastAPI(title="Prelegal API", lifespan=lifespan)

SessionDep = Annotated[Session, Depends(get_session)]


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
