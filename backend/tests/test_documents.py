import json
import re

import pytest

from app.config import CATALOG_FILE, TEMPLATES_DIR
from app.documents import (
    ChatTurn,
    DocumentState,
    FieldUpdate,
    Party,
    PartyUpdate,
    apply_turn,
    fields_at_default,
    load_specs,
    missing_fields,
    select_type,
)
from app.seed import slug_for

SPECS = load_specs()

# Terms that the Standard Terms link to a party's details rather than to a field.
PARTY_TERMS = {"Notice Address"}


def turn(**kwargs) -> ChatTurn:
    return ChatTurn(reply="ok", **{"document_type": None, "field_updates": [], "party_updates": [], **kwargs})


# --- documents.json ---


def test_every_spec_has_a_template_and_unique_keys():
    catalog_slugs = {slug_for(e["filename"]) for e in json.loads(CATALOG_FILE.read_text(encoding="utf-8"))}
    assert len(SPECS) == 11
    for spec in SPECS.values():
        assert spec.slug in catalog_slugs
        keys = [f.key for f in spec.fields]
        assert len(keys) == len(set(keys)), spec.slug


@pytest.mark.parametrize("slug", sorted(SPECS))
def test_every_linked_term_in_the_template_has_a_field(slug):
    """Each term the Standard Terms link to the cover page must be a field or a party role,
    so the preview can link it and the chat asks about it."""
    spec = SPECS[slug]
    known = {spec.parties[0], spec.parties[1], *PARTY_TERMS}
    for field in spec.fields:
        known.update([field.label, *field.aliases])

    filename = next(e["filename"] for e in json.loads(CATALOG_FILE.read_text(encoding="utf-8")) if slug_for(e["filename"]) == slug)
    content = (TEMPLATES_DIR / filename).read_text(encoding="utf-8")
    terms = {re.sub(r"[’']s$", "", t) for t in re.findall(r'<span class="\w+_link"[^>]*>(.*?)</span>', content)}
    assert terms, slug
    assert terms <= known, f"{slug}: no field for {sorted(terms - known)}"


# --- Choosing a document and applying Claude's updates ---


def test_select_type_starts_at_defaults_and_carries_shared_values_over():
    nda = select_type(DocumentState(), SPECS["mutual-nda"])
    assert nda.fields["mnda_term"] == "Expires 1 year from Effective Date."
    assert nda.fields["purpose"] == ""

    nda.fields["governing_law"] = "Delaware"
    nda.parties[0].company = "Acme Inc."
    csa = select_type(nda, SPECS["csa"])
    assert csa.type == "csa"
    assert csa.fields["governing_law"] == "Delaware"
    assert "mnda_term" not in csa.fields
    assert csa.parties[0].company == "Acme Inc."


def test_apply_turn_selects_type_then_applies_updates():
    doc = apply_turn(
        DocumentState(),
        turn(
            document_type="pilot-agreement",
            field_updates=[FieldUpdate(key="pilot_period", value=" 90 days "), FieldUpdate(key="bogus", value="x")],
            party_updates=[PartyUpdate(party=2, company="Globex LLC")],
        ),
    )
    assert doc.type == "pilot-agreement"
    assert doc.fields["pilot_period"] == "90 days"
    assert "bogus" not in doc.fields
    assert doc.parties[1].company == "Globex LLC"
    assert doc.parties[0].company == ""


def test_apply_turn_ignores_unknown_types_and_bad_dates():
    doc = apply_turn(DocumentState(), turn(document_type="employment-contract"))
    assert doc.type is None

    doc = select_type(DocumentState(), SPECS["csa"])
    doc = apply_turn(
        doc,
        turn(field_updates=[FieldUpdate(key="effective_date", value="next Tuesday"), FieldUpdate(key="order_date", value="2026-11-01")]),
    )
    assert doc.fields["effective_date"] == ""
    assert doc.fields["order_date"] == "2026-11-01"


def test_apply_turn_does_not_mutate_input():
    doc = select_type(DocumentState(), SPECS["baa"])
    apply_turn(doc, turn(field_updates=[FieldUpdate(key="breach_notification_period", value="30 days")]))
    assert doc.fields["breach_notification_period"] == ""


def test_missing_fields_skips_optional_fields_and_names_party_roles():
    spec = SPECS["design-partner-agreement"]
    doc = select_type(DocumentState(), spec)
    doc.fields |= {"program": "Beta", "effective_date": "2026-10-16", "term": "6 months", "governing_law": "Delaware"}
    doc.parties = [Party(company="Acme", name="Ada", title="CEO", notice_address="ada@acme.test"), Party()]

    missing = missing_fields(doc, spec)
    assert "Chosen Courts" in missing
    assert "Fees" not in missing  # optional
    assert "Partner company" in missing and "Provider company" not in missing
    assert len(missing) == 5


def test_fields_at_default():
    spec = SPECS["mutual-nda"]
    doc = select_type(DocumentState(), spec)
    assert fields_at_default(doc, spec) == ["MNDA Term", "Term of Confidentiality"]
    doc.fields["mnda_term"] = "Expires 2 years from Effective Date."
    assert fields_at_default(doc, spec) == ["Term of Confidentiality"]


# --- Endpoints ---


def test_lists_documents(client):
    response = client.get("/api/documents")
    assert response.status_code == 200
    docs = response.json()
    assert [d["slug"] for d in docs][:2] == ["mutual-nda", "csa"]
    assert docs[1]["coverTitle"] == "Order Form"
    assert "content" not in docs[0]


def test_get_document_includes_standard_terms(client):
    response = client.get("/api/documents/psa")
    assert response.status_code == 200
    body = response.json()
    assert body["parties"] == ["Provider", "Customer"]
    assert body["content"].startswith("# Professional Services Agreement")
    assert client.get("/api/documents/nope").status_code == 404
