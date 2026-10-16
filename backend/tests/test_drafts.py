from fastapi.testclient import TestClient

from app.documents import ChatTurn, DocumentState, FieldUpdate, PartyUpdate
from app.main import app
from tests.conftest import signup
from tests.test_chat import chat_body, use_fake


def start_document(client, monkeypatch) -> dict:
    """One chat turn that picks a Mutual NDA between Acme and Globex; returns the response."""
    use_fake(
        monkeypatch,
        ChatTurn(
            reply="A Mutual NDA it is. What's the purpose?",
            document_type="mutual-nda",
            field_updates=[FieldUpdate(key="governing_law", value="Delaware")],
            party_updates=[PartyUpdate(party=1, company="Acme Inc."), PartyUpdate(party=2, company="Globex Corp")],
        ),
    )
    response = client.post("/api/chat", json=chat_body(("user", "An NDA between Acme Inc. and Globex Corp")))
    assert response.status_code == 200, response.text
    return response.json()


def test_first_turn_creates_a_draft_with_the_conversation(user_client, monkeypatch):
    body = start_document(user_client, monkeypatch)
    draft_id = body["draftId"]
    assert draft_id

    drafts = user_client.get("/api/drafts").json()
    assert [d["id"] for d in drafts] == [draft_id]
    assert drafts[0]["title"] == "Mutual NDA: Acme Inc. & Globex Corp"
    assert drafts[0]["type"] == "mutual-nda"
    assert drafts[0]["missingCount"] > 0

    draft = user_client.get(f"/api/drafts/{draft_id}").json()
    assert draft["document"]["fields"]["governing_law"] == "Delaware"
    assert [m["role"] for m in draft["messages"]] == ["user", "assistant"]
    assert draft["messages"][1]["content"] == "A Mutual NDA it is. What's the purpose?"


def test_later_turns_update_the_same_draft(user_client, monkeypatch):
    first = start_document(user_client, monkeypatch)
    history = [("user", "An NDA between Acme Inc. and Globex Corp"), ("assistant", first["reply"]), ("user", "Evaluating a partnership")]
    body = chat_body(*history, document=DocumentState.model_validate(first["document"]))
    body["draftId"] = first["draftId"]

    response = user_client.post("/api/chat", json=body)
    assert response.json()["draftId"] == first["draftId"]
    assert len(user_client.get("/api/drafts").json()) == 1
    assert len(user_client.get(f"/api/drafts/{first['draftId']}").json()["messages"]) == 4


def test_delete_draft(user_client, monkeypatch):
    draft_id = start_document(user_client, monkeypatch)["draftId"]
    assert user_client.delete(f"/api/drafts/{draft_id}").status_code == 204
    assert user_client.get("/api/drafts").json() == []
    assert user_client.get(f"/api/drafts/{draft_id}").status_code == 404


def test_drafts_are_private(user_client, monkeypatch):
    draft_id = start_document(user_client, monkeypatch)["draftId"]

    with TestClient(app) as other:
        signup(other)
        assert other.get("/api/drafts").json() == []
        assert other.get(f"/api/drafts/{draft_id}").status_code == 404
        assert other.delete(f"/api/drafts/{draft_id}").status_code == 404
        # Nor can another user continue (and so overwrite) someone else's draft.
        body = chat_body(("user", "Hi"))
        body["draftId"] = draft_id
        assert other.post("/api/chat", json=body).status_code == 404

    assert user_client.get(f"/api/drafts/{draft_id}").status_code == 200


def test_drafts_require_login(client):
    assert client.get("/api/drafts").status_code == 401
    assert client.get("/api/drafts/abc").status_code == 401
    assert client.delete("/api/drafts/abc").status_code == 401
