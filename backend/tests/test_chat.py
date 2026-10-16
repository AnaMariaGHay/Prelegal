from types import SimpleNamespace

import pytest

from app.main import app, get_claude
from app.nda import ChatTurn, NdaDocument, NdaUpdate, PartyUpdate, apply_update, missing_fields


class FakeClaude:
    """Stands in for anthropic.AsyncAnthropic: records the request, returns a canned turn."""

    def __init__(self, turn: ChatTurn | None, stop_reason: str = "end_turn"):
        self.calls: list[dict] = []
        self._response = SimpleNamespace(parsed_output=turn, stop_reason=stop_reason)
        self.beta = SimpleNamespace(messages=SimpleNamespace(parse=self._parse))

    async def _parse(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


@pytest.fixture
def fake_claude(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    fake = FakeClaude(
        ChatTurn(
            reply="Thanks! Who will sign for Acme?",
            updates=NdaUpdate(party1=PartyUpdate(company="Acme Inc."), party2=PartyUpdate(company="Globex LLC")),
        )
    )
    app.dependency_overrides[get_claude] = lambda: fake
    yield fake
    app.dependency_overrides.pop(get_claude, None)


def chat_body(*messages: tuple[str, str], document: dict | None = None) -> dict:
    return {
        "messages": [{"role": role, "content": content} for role, content in messages],
        "document": document or NdaDocument().model_dump(by_alias=True),
    }


# --- Merging Claude's updates into the document ---


def test_apply_update_changes_only_given_fields():
    doc = NdaDocument(purpose="Original purpose", governing_law="Delaware")
    updated = apply_update(doc, NdaUpdate(governing_law=" California ", party2=PartyUpdate(name="Alan Turing")))

    assert updated.governing_law == "California"
    assert updated.purpose == "Original purpose"
    assert updated.party2.name == "Alan Turing"
    assert updated.party2.company == ""
    assert doc.governing_law == "Delaware"  # the input is not mutated


def test_apply_update_normalizes_terms():
    doc = apply_update(
        NdaDocument(),
        NdaUpdate.model_validate(
            {"mnda_term": {"kind": "untilTerminated", "years": 3}, "confidentiality_term": {"kind": "years", "years": 0}}
        ),
    )
    assert doc.mnda_term.kind == "untilTerminated" and doc.mnda_term.years is None
    assert doc.confidentiality_term.kind == "years" and doc.confidentiality_term.years == 1


def test_missing_fields_lists_blank_required_fields():
    doc = NdaDocument(purpose="x", effective_date="2026-10-16", governing_law="Delaware", jurisdiction="New Castle, DE")
    missing = missing_fields(doc)
    assert "party 1 company" in missing and "party 2 notice address" in missing
    assert "purpose" not in missing and len(missing) == 8


# --- The chat endpoint ---


def test_chat_turn_returns_reply_and_updated_document(client, fake_claude):
    response = client.post("/api/chat/mutual-nda", json=chat_body(("user", "Acme Inc. and Globex LLC")))

    assert response.status_code == 200
    body = response.json()
    assert body["reply"] == "Thanks! Who will sign for Acme?"
    assert body["document"]["party1"]["company"] == "Acme Inc."
    assert body["document"]["party2"]["company"] == "Globex LLC"
    assert body["document"]["party1"]["noticeAddress"] == ""  # camelCase, like the frontend


def test_chat_request_is_cache_friendly(client, fake_claude):
    client.post(
        "/api/chat/mutual-nda",
        json=chat_body(("user", "Acme and Globex"), ("assistant", "Great. What's the purpose?"), ("user", "A pilot")),
    )
    request = fake_claude.calls[0]

    # Stable system prompt with the Standard Terms, cached.
    assert request["system"][0]["cache_control"] == {"type": "ephemeral"}
    assert "Use and Protection of Confidential Information" in request["system"][0]["text"]
    # History first, with a cache breakpoint on the latest user message...
    messages = request["messages"]
    assert [m["role"] for m in messages] == ["user", "assistant", "user", "system"]
    assert messages[2]["content"][0] == {"type": "text", "text": "A pilot", "cache_control": {"type": "ephemeral"}}
    # ...then the volatile state as a trailing system note.
    assert "Today's date is" in messages[3]["content"] and "Still missing:" in messages[3]["content"]
    assert request["fallbacks"] == "default"
    assert request["output_format"] is ChatTurn


def test_chat_without_api_key_is_503(client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    response = client.post("/api/chat/mutual-nda", json=chat_body(("user", "Hi")))
    assert response.status_code == 503
    assert "backend/.env" in response.json()["detail"]


def test_chat_must_end_with_user_message(client, fake_claude):
    response = client.post("/api/chat/mutual-nda", json=chat_body(("user", "Hi"), ("assistant", "Hello")))
    assert response.status_code == 422
    assert fake_claude.calls == []


def test_refusal_is_reported(client, fake_claude):
    fake = FakeClaude(None, stop_reason="refusal")
    app.dependency_overrides[get_claude] = lambda: fake
    response = client.post("/api/chat/mutual-nda", json=chat_body(("user", "Hi")))
    assert response.status_code == 422
    assert "can't help" in response.json()["detail"]


def test_greeting_endpoint(client):
    response = client.get("/api/chat/mutual-nda")
    assert response.status_code == 200
    assert "two parties" in response.json()["greeting"]
