"""Supported document types, a document's state, and the updates Claude returns from a chat turn.

Each document type is described by a curated spec in documents.json: its two party roles
and the fields that go on its cover page. `DocumentState` mirrors the frontend's
`DocumentState` type (camelCase JSON). `ChatTurn` is the structured-output schema Claude
fills in each turn.
"""

import json
import re
from datetime import date
from functools import cache
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints
from pydantic.alias_generators import to_camel

from app.config import DOCUMENTS_FILE


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


# --- Document type specs (documents.json) ---


class FieldSpec(CamelModel):
    key: str
    label: str
    type: Literal["text", "longtext", "date"] = "text"
    help: str
    default: str = ""
    optional: bool = False
    # Other spellings of the label used in the Standard Terms, e.g. plurals.
    aliases: list[str] = []


class DocumentSpec(CamelModel):
    slug: str  # also the template's slug in the database
    name: str
    short_name: str | None = None
    summary: str
    cover_title: str
    parties: tuple[str, str]
    fields: list[FieldSpec]
    intro: str | None = None
    signing_statement: str | None = None
    attribution: str

    def field(self, key: str) -> FieldSpec | None:
        return next((f for f in self.fields if f.key == key), None)


@cache
def load_specs() -> dict[str, DocumentSpec]:
    specs = [DocumentSpec.model_validate(s) for s in json.loads(DOCUMENTS_FILE.read_text(encoding="utf-8"))]
    return {s.slug: s for s in specs}


# --- A document being drafted ---

Value = Annotated[str, StringConstraints(max_length=4000)]


class Party(CamelModel):
    company: Value = ""
    name: Value = ""
    title: Value = ""
    notice_address: Value = ""


class DocumentState(CamelModel):
    type: str | None = None  # a spec slug, or None before the user has chosen a document
    fields: dict[str, Value] = Field(default_factory=dict, max_length=50)
    parties: list[Party] = Field(default_factory=lambda: [Party(), Party()], min_length=2, max_length=2)


# --- Structured output schema for Claude (snake_case) ---


class FieldUpdate(BaseModel):
    key: str = Field(description="A field key of the selected document, e.g. 'governing_law'")
    value: str = Field(description="The new value. Dates as YYYY-MM-DD. An empty string clears the field.")


class PartyUpdate(BaseModel):
    party: Literal[1, 2] = Field(description="1 for the document's first party role, 2 for its second")
    company: str | None = None
    name: str | None = Field(None, description="Full name of the person signing for this party")
    title: str | None = Field(None, description="Job title of the signatory")
    notice_address: str | None = Field(None, description="Email or postal address for legal notices")


class ChatTurn(BaseModel):
    reply: str = Field(description="The message to show the user, in plain text")
    document_type: str | None = Field(
        description="Slug of the document to start or switch to, once the user has chosen it. null means no change."
    )
    field_updates: list[FieldUpdate] = Field(description="Only values the user has stated or confirmed")
    party_updates: list[PartyUpdate] = Field(description="Only details the user has stated or confirmed")


def select_type(state: DocumentState, spec: DocumentSpec) -> DocumentState:
    """Switch `state` to the document type `spec`.

    Values for field keys the new type shares (such as the effective date or governing
    law) and the party details carry over. Other fields start at the spec's defaults.
    """
    fields = {f.key: state.fields.get(f.key) or f.default for f in spec.fields}
    return DocumentState(type=spec.slug, fields=fields, parties=[p.model_copy() for p in state.parties])


def _is_iso_date(value: str) -> bool:
    try:
        date.fromisoformat(value)
    except ValueError:
        return False
    return bool(re.fullmatch(r"\d{4}-\d{2}-\d{2}", value))


def apply_turn(state: DocumentState, turn: ChatTurn) -> DocumentState:
    """Return a copy of `state` with Claude's document choice and updates applied.

    Unknown document types, unknown field keys and malformed dates are ignored rather
    than trusted.
    """
    specs = load_specs()
    doc = state.model_copy(deep=True)
    if turn.document_type and turn.document_type != doc.type and turn.document_type in specs:
        doc = select_type(doc, specs[turn.document_type])
    spec = specs.get(doc.type) if doc.type else None
    if spec is None:
        return doc

    for update in turn.field_updates:
        field = spec.field(update.key)
        value = update.value.strip()[:4000]
        if field is None or (field.type == "date" and value and not _is_iso_date(value)):
            continue
        doc.fields[field.key] = value

    for update in turn.party_updates:
        party = doc.parties[update.party - 1]
        for name in ("company", "name", "title", "notice_address"):
            value = getattr(update, name)
            if value is not None:
                setattr(party, name, value.strip()[:4000])
    return doc


def missing_fields(state: DocumentState, spec: DocumentSpec) -> list[str]:
    """Labels of required fields and party details that are still blank."""
    missing = [f.label for f in spec.fields if not f.optional and not state.fields.get(f.key, "").strip()]
    for role, party in zip(spec.parties, state.parties):
        for label, value in (
            ("company", party.company),
            ("signatory name", party.name),
            ("signatory title", party.title),
            ("notice address", party.notice_address),
        ):
            if not value.strip():
                missing.append(f"{role} {label}")
    return missing


def fields_at_default(state: DocumentState, spec: DocumentSpec) -> list[str]:
    """Labels of fields that still hold the template's default, which Claude should confirm."""
    return [f.label for f in spec.fields if f.default and state.fields.get(f.key) == f.default]
