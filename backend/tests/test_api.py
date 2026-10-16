import json

from app.config import CATALOG_FILE


def test_health(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_lists_every_catalog_template(client):
    catalog = json.loads(CATALOG_FILE.read_text(encoding="utf-8"))

    response = client.get("/api/templates")

    assert response.status_code == 200
    templates = response.json()
    assert sorted(t["filename"] for t in templates) == sorted(e["filename"] for e in catalog)
    assert all("content" not in t for t in templates)


def test_get_template_returns_markdown_content(client):
    response = client.get("/api/templates/mutual-nda")

    assert response.status_code == 200
    body = response.json()
    assert body["filename"] == "Mutual-NDA.md"
    assert body["content"].startswith("# Standard Terms")


def test_unknown_template_is_404(client):
    response = client.get("/api/templates/does-not-exist")
    assert response.status_code == 404
