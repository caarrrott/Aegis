"""API endpoint tests using FastAPI TestClient."""

from datetime import date

from fastapi.testclient import TestClient

from assistant import api, ingestion, models, repository


def test_api_endpoints(monkeypatch):
    class DummyConn:
        def __enter__(self):
            return self

        def __exit__(self, *args):
            pass

    monkeypatch.setattr(repository, "connection", lambda: DummyConn())
    monkeypatch.setattr(repository, "create_schema", lambda conn: None)
    monkeypatch.setattr(repository, "close_pool", lambda: None)
    monkeypatch.setattr(
        repository,
        "counts",
        lambda conn: {
            "documents": 2,
            "active_documents": 2,
            "chunks": 6,
            "last_indexed": "2026-10-10T00:00:00Z",
        },
    )
    monkeypatch.setattr(
        repository,
        "list_documents",
        lambda conn: [
            {
                "title": "Refund policy",
                "version": 1,
                "status": "active",
                "department": "support",
                "visibility": "public",
                "source": "refund.md",
                "updated_on": date(2026, 10, 1),
                "chunks": 3,
            }
        ],
    )

    class FakeAssistant:
        def ask(self, question: str, username: str = "guest"):
            return models.Answer(
                question=question,
                text="Customers may request a full refund within 30 days.",
                answered=True,
                citations=[
                    models.Citation(
                        label="Refund policy v1 > Refund Policy",
                        quote="Customers may request a full refund within 30 days of delivery.",
                        updated_on=date(2026, 10, 1),
                        status="active",
                        grounded=True,
                    )
                ],
                warnings=[],
                trace=["user Guest (none), can read public documents only"],
            )

    with TestClient(api.app) as client:
        api.state["assistant"] = FakeAssistant()

        r_health = client.get("/health")
        assert r_health.status_code == 200
        assert r_health.json()["documents"] == 2

        r_docs = client.get("/documents")
        assert r_docs.status_code == 200
        assert len(r_docs.json()["documents"]) == 1

        r_ask = client.post(
            "/ask", json={"question": "What is the refund policy?", "username": "guest"}
        )
        assert r_ask.status_code == 200
        payload = r_ask.json()
        assert payload["answered"] is True
        assert payload["grounded"] is True
        assert payload["citations"][0]["source"] == "Refund policy v1 > Refund Policy"

        monkeypatch.setattr(
            ingestion,
            "store",
            lambda conn, text, filename: ingestion.UploadResult(
                filename=filename,
                outcome="added",
                title="Leave policy",
                version=1,
                chunks=2,
            ),
        )
        r_up = client.post(
            "/documents",
            files={"file": ("leave.md", b"---\ntitle: Leave policy\n---\n# Body", "text/markdown")},
        )
        assert r_up.status_code == 200
        assert r_up.json()["outcome"] == "added"
