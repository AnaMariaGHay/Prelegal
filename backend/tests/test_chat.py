from types import SimpleNamespace

import pytest

from app.documents import ChatTurn, DocumentState, FieldUpdate, PartyUpdate, load_specs, select_type
from app.main import app, get_claude


class FakeClaude:
    """Stands in for anthropic.AsyncAnthropic: records the request, returns a canned turn."""

    def __init__(self, turn: ChatTurn | None, stop_reason: str = "end_turn"):
        self.calls: list[dict] = []
        self._response = SimpleNamespace(parsed_output=turn, stop_reason=stop_reason)
        self.beta = SimpleNamespace(messages=SimpleNamespace(parse=self._parse))

    async def _parse(self, **kwargs):
        self.calls.append(kwargs)
        return self._response


def use_fake(monkeypatch, turn: ChatTurn | None, stop_reason: str = "end_turn") -> FakeClaude:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    fake = FakeClaude(turn, stop_reason)
    app.dependency_overrides[get_claude] = lambda: fake
    return fake


@pytest.fixture(autouse=True)
def clear_overrides():
    yield
    app.dependency_overrides.pop(get_claude, None)


@pytest.fixture
def fake_claude(monkeypatch):
    return use_fake(
        monkeypatch,
        ChatTurn(
            reply="A Cloud Service Agreement it is. Who is the provider?",
            document_type="csa",
            field_updates=[FieldUpdate(key="governing_law", value="Delaware")],
            party_updates=[PartyUpdate(party=2, company="Globex LLC")],
        ),
    )


def chat_body(*messages: tuple[str, str], document: DocumentState | None = None) -> dict:
    return {
        "messages": [{"role": role, "content": content} for role, content in messages],
        "document": (document or DocumentState()).model_dump(by_alias=True),
    }


def test_chat_turn_selects_document_and_fills_fields(user_client, fake_claude):
    response = user_client.post("/api/chat", json=chat_body(("user", "We sell SaaS to Globex LLC")))

    assert response.status_code == 200
    body = response.json()
    assert body["reply"].startswith("A Cloud Service Agreement")
    document = body["document"]
    assert document["type"] == "csa"
    assert document["fields"]["governing_law"] == "Delaware"
    assert document["fields"]["subscription_period"] == ""
    assert document["parties"][1]["company"] == "Globex LLC"
    assert document["parties"][1]["noticeAddress"] == ""  # camelCase, like the frontend


def test_first_turn_has_catalog_but_no_standard_terms(user_client, fake_claude):
    user_client.post("/api/chat", json=chat_body(("user", "I need a contract")))
    request = fake_claude.calls[0]

    assert len(request["system"]) == 1
    catalog = request["system"][0]
    assert catalog["cache_control"] == {"type": "ephemeral"}
    assert "slug: partnership-agreement" in catalog["text"] and "governing_member_state" in catalog["text"]
    assert "No document has been chosen yet." in request["messages"][-1]["content"]


def test_chat_request_with_selected_document_is_cache_friendly(user_client, fake_claude):
    document = select_type(DocumentState(), load_specs()["mutual-nda"])
    user_client.post(
        "/api/chat",
        json=chat_body(
            ("user", "An NDA please"), ("assistant", "Sure. Who are the parties?"), ("user", "Acme and Globex"),
            document=document,
        ),
    )
    request = fake_claude.calls[0]

    # The catalog, then the selected document's Standard Terms, each cached.
    assert [block["cache_control"] for block in request["system"]] == [{"type": "ephemeral"}] * 2
    assert "Use and Protection of Confidential Information" in request["system"][1]["text"]
    # History first, with a cache breakpoint on the latest user message...
    messages = request["messages"]
    assert [m["role"] for m in messages] == ["user", "assistant", "user", "system"]
    assert messages[2]["content"][0] == {"type": "text", "text": "Acme and Globex", "cache_control": {"type": "ephemeral"}}
    # ...then the volatile state as a trailing system note.
    note = messages[3]["content"]
    assert "Today's date is" in note and "Selected document: Mutual Non-Disclosure Agreement" in note
    assert "Still missing: Purpose, Effective Date" in note
    assert "confirm with the user): MNDA Term, Term of Confidentiality" in note
    assert request["fallbacks"] == "default"
    assert request["output_format"] is ChatTurn


def test_unknown_document_type_is_rejected(user_client, fake_claude):
    body = chat_body(("user", "Hi"))
    body["document"]["type"] = "lease"
    response = user_client.post("/api/chat", json=body)
    assert response.status_code == 422
    assert fake_claude.calls == []


def test_chat_requires_login(client, fake_claude):
    response = client.post("/api/chat", json=chat_body(("user", "Hi")))
    assert response.status_code == 401
    assert fake_claude.calls == []


def test_chat_without_api_key_is_503(user_client, monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    monkeypatch.delenv("ANTHROPIC_AUTH_TOKEN", raising=False)
    response = user_client.post("/api/chat", json=chat_body(("user", "Hi")))
    assert response.status_code == 503
    assert "backend/.env" in response.json()["detail"]


def test_chat_must_end_with_user_message(user_client, fake_claude):
    response = user_client.post("/api/chat", json=chat_body(("user", "Hi"), ("assistant", "Hello")))
    assert response.status_code == 422
    assert fake_claude.calls == []


def test_refusal_is_reported(user_client, monkeypatch):
    use_fake(monkeypatch, None, stop_reason="refusal")
    response = user_client.post("/api/chat", json=chat_body(("user", "Hi")))
    assert response.status_code == 422
    assert "can't help" in response.json()["detail"]


def test_greeting_endpoint(client):
    response = client.get("/api/chat")
    assert response.status_code == 200
    assert "What would you like to create?" in response.json()["greeting"]
