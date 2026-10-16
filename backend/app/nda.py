"""Mutual NDA document state, and the field updates Claude returns from a chat turn.

`NdaDocument` mirrors the frontend's `NdaData` type (camelCase JSON). `NdaUpdate` is the
structured-output schema Claude fills in: every field is optional, and `None` means
"leave this field unchanged".
"""

from typing import Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel


class CamelModel(BaseModel):
    model_config = ConfigDict(alias_generator=to_camel, populate_by_name=True)


class Party(CamelModel):
    name: str = ""
    title: str = ""
    company: str = ""
    notice_address: str = ""


class MndaTerm(CamelModel):
    kind: Literal["expires", "untilTerminated"] = "expires"
    years: int | None = 1


class ConfidentialityTerm(CamelModel):
    kind: Literal["years", "perpetual"] = "years"
    years: int | None = 1


class NdaDocument(CamelModel):
    purpose: str = ""
    effective_date: str = ""  # ISO date (YYYY-MM-DD), or "" if not chosen yet
    mnda_term: MndaTerm = Field(default_factory=MndaTerm)
    confidentiality_term: ConfidentialityTerm = Field(default_factory=ConfidentialityTerm)
    governing_law: str = ""
    jurisdiction: str = ""
    modifications: str = ""
    party1: Party = Field(default_factory=Party)
    party2: Party = Field(default_factory=Party)


# --- Structured output schema for Claude (snake_case; None = unchanged) ---


class PartyUpdate(BaseModel):
    company: str | None = None
    name: str | None = Field(None, description="Full name of the person signing for this party")
    title: str | None = Field(None, description="Job title of the signatory")
    notice_address: str | None = Field(None, description="Email or postal address for legal notices")


class MndaTermUpdate(BaseModel):
    kind: Literal["expires", "untilTerminated"]
    years: int | None = Field(None, description="Whole number of years; required when kind is 'expires'")


class ConfidentialityTermUpdate(BaseModel):
    kind: Literal["years", "perpetual"]
    years: int | None = Field(None, description="Whole number of years; required when kind is 'years'")


class NdaUpdate(BaseModel):
    purpose: str | None = None
    effective_date: str | None = Field(None, description="ISO date, YYYY-MM-DD")
    mnda_term: MndaTermUpdate | None = None
    confidentiality_term: ConfidentialityTermUpdate | None = None
    governing_law: str | None = Field(None, description="A US state, e.g. 'Delaware'")
    jurisdiction: str | None = Field(None, description="Courts' city or county and state, e.g. 'New Castle, DE'")
    modifications: str | None = None
    party1: PartyUpdate | None = None
    party2: PartyUpdate | None = None


class ChatTurn(BaseModel):
    reply: str = Field(description="The message to show the user, in plain text")
    updates: NdaUpdate = Field(description="Only fields the user has stated or confirmed in this conversation")


def _years(value: int | None) -> int:
    return max(1, value or 1)


def apply_update(document: NdaDocument, update: NdaUpdate) -> NdaDocument:
    """Return a copy of `document` with every non-None field of `update` applied."""
    doc = document.model_copy(deep=True)
    for field in ("purpose", "effective_date", "governing_law", "jurisdiction", "modifications"):
        value = getattr(update, field)
        if value is not None:
            setattr(doc, field, value.strip())

    if update.mnda_term is not None:
        term = update.mnda_term
        doc.mnda_term = MndaTerm(kind=term.kind, years=_years(term.years) if term.kind == "expires" else None)
    if update.confidentiality_term is not None:
        term = update.confidentiality_term
        doc.confidentiality_term = ConfidentialityTerm(
            kind=term.kind, years=_years(term.years) if term.kind == "years" else None
        )

    for which in ("party1", "party2"):
        party_update: PartyUpdate | None = getattr(update, which)
        if party_update is None:
            continue
        party: Party = getattr(doc, which)
        for field in ("company", "name", "title", "notice_address"):
            value = getattr(party_update, field)
            if value is not None:
                setattr(party, field, value.strip())
    return doc


def missing_fields(document: NdaDocument) -> list[str]:
    """Names of required cover page fields that are still blank (modifications is optional)."""
    missing = [
        label
        for label, value in (
            ("purpose", document.purpose),
            ("effective date", document.effective_date),
            ("governing law", document.governing_law),
            ("jurisdiction", document.jurisdiction),
        )
        if not value
    ]
    for which, party in (("party 1", document.party1), ("party 2", document.party2)):
        for label, value in (
            ("company", party.company),
            ("signatory name", party.name),
            ("title", party.title),
            ("notice address", party.notice_address),
        ):
            if not value:
                missing.append(f"{which} {label}")
    return missing
