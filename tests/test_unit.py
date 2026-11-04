"""Unit tests for the Aegis RAG specification (models, ingestion, retrieval, generation, pipeline)."""

from datetime import date
from types import SimpleNamespace

import pytest

from assistant import generation, ingestion, models, pipeline, repository, retrieval


def test_models_dataclasses_and_grounding():
    user_guest = models.User("guest", "Guest", "none", False)
    user_emp = models.User("alice", "Alice", "engineering", True)
    assert user_guest.describe_access() == "public documents only"
    assert (
        user_emp.describe_access()
        == "public and internal documents, plus restricted engineering documents"
    )

    hit = models.Hit(
        chunk_id=1,
        content="Full-time employees receive 25 days of paid annual leave.",
        section="How many leaves",
        source="leave.md",
        title="Leave policy",
        version=1,
        status="active",
        updated_on=date(2026, 6, 30),
        score=0.032,
    )
    assert hit.label == "Leave policy v1 > How many leaves"

    refusal = models.Answer(question="q", text="Cannot answer", answered=False)
    assert refusal.fully_grounded is False

    grounded_answer = models.Answer(
        question="q",
        text="25 days",
        answered=True,
        citations=[
            models.Citation(
                label=hit.label,
                quote="Full-time employees receive 25 days of paid annual leave.",
                updated_on=hit.updated_on,
                status="active",
                grounded=True,
            )
        ],
    )
    assert grounded_answer.fully_grounded is True


VALID_MD = """---
title: Leave policy
department: hr
visibility: internal
version: 1
status: active
effective: 2026-06-30
updated: 2026-06-30
---

# Leave policy

## How many leaves

Full-time employees receive 25 days of paid annual leave per calendar year.

## Carryover rules

Employees may carry over up to 5 unused days into the first quarter of the next year.
"""


def test_parse_and_split_by_h2_headings():
    doc = ingestion.parse(VALID_MD, "leave-policy.md")
    assert doc.source == "leave-policy.md"
    assert doc.title == "Leave policy"
    assert doc.department == "hr"
    assert doc.visibility == "internal"
    assert doc.version == 1
    assert doc.status == "active"
    assert doc.effective_from == date(2026, 6, 30)
    assert doc.updated_on == date(2026, 6, 30)

    chunks = ingestion.split(doc)
    sections = [c.section for c in chunks]
    assert "How many leaves" in sections
    assert "Carryover rules" in sections


def test_parse_crlf_produces_identical_hash():
    crlf_md = VALID_MD.replace("\n", "\r\n")
    doc_lf = ingestion.parse(VALID_MD, "a.md")
    doc_crlf = ingestion.parse(crlf_md, "b.md")
    assert doc_lf.content_hash == doc_crlf.content_hash


def test_parse_rejects_missing_header_or_fields():
    with pytest.raises(ingestion.UploadError):
        ingestion.parse("No frontmatter header", "bad.md")

    with pytest.raises(ingestion.UploadError):
        ingestion.parse("---\ntitle: Only title\n---\nBody", "bad.md")


def test_sample_documents_corpus_is_valid():
    files = sorted(ingestion.config.DOCUMENTS_DIR.glob("*.md"))
    assert len(files) >= 8
    for path in files:
        doc = ingestion.parse(path.read_text(encoding="utf-8"), path.name)
        chunks = ingestion.split(doc)
        assert len(chunks) >= 1


def test_flatten_and_generator_quote_verification_and_warnings():
    hit = models.Hit(
        chunk_id=1,
        content="Full-time employees receive 25 days of paid annual leave per calendar year.",
        section="How many leaves",
        source="leave.md",
        title="Leave policy",
        version=1,
        status="superseded",
        updated_on=date(2025, 1, 1),
        score=9.0,
    )

    calls = []

    class FakeModel:
        def invoke(self, messages):
            calls.append(messages)
            if len(calls) == 1:
                # First attempt quotes a fabricated sentence -> triggers retry with REMINDER
                return generation._Draft(
                    answer="You get 25 days.",
                    citations=[
                        generation._DraftCitation(
                            chunk_number=1,
                            quote="This sentence does not exist in the chunk.",
                        )
                    ],
                    answered=True,
                )
            return generation._Draft(
                answer="You get 25 days of paid annual leave.",
                citations=[
                    generation._DraftCitation(
                        chunk_number=1,
                        quote="Full-time employees receive 25 days of paid annual leave per calendar year.",
                    )
                ],
                answered=True,
            )

    gen = generation.Generator.__new__(generation.Generator)
    gen.model = FakeModel()

    answer = gen.write("How much leave?", [hit], today=date(2026, 10, 10))
    assert len(calls) == 2
    assert answer.answered is True
    assert answer.fully_grounded is True
    assert any("reviewed" in w for w in answer.warnings)
    assert any("superseded version" in w for w in answer.warnings)


def test_retriever_reranks_and_cuts_below_min_score():
    candidates = [
        models.Hit(
            chunk_id=10,
            content="Chunk one content",
            section="S1",
            source="a.md",
            title="Doc A",
            version=1,
            status="active",
            updated_on=date(2026, 9, 1),
            score=0.03,
        ),
        models.Hit(
            chunk_id=20,
            content="Chunk two content",
            section="S2",
            source="b.md",
            title="Doc B",
            version=1,
            status="active",
            updated_on=date(2026, 9, 1),
            score=0.02,
        ),
    ]

    retriever = retrieval.Retriever.__new__(retrieval.Retriever)
    retriever.reranker = SimpleNamespace(
        invoke=lambda _prompt: retrieval._Ratings(
            ratings=[
                retrieval._Rating(index=1, score=9),
                retrieval._Rating(index=2, score=2),
            ]
        )
    )

    kept = retriever._rerank("question", candidates)
    assert len(kept) == 1
    assert kept[0].chunk_id == 10
    assert kept[0].score == 9


def test_pipeline_high_confidence_shortcut(monkeypatch):
    hit = models.Hit(
        chunk_id=1,
        content="Full-time employees receive 25 days of paid annual leave per calendar year.",
        section="How many leaves",
        source="leave.md",
        title="Leave policy",
        version=1,
        status="active",
        updated_on=date(2026, 8, 15),
        score=9,
    )

    monkeypatch.setattr(
        repository,
        "find_user",
        lambda conn, u: models.User("bob", "Bob", "hr", True),
    )
    monkeypatch.setattr(
        repository,
        "searchable_chunks",
        lambda conn, user, wants_history: {"allowed": 31, "total": 44},
    )
    recorded = []
    monkeypatch.setattr(
        repository,
        "record_event",
        lambda conn, **kwargs: recorded.append(kwargs),
    )

    assistant = pipeline.Assistant.__new__(pipeline.Assistant)
    assistant.intent = SimpleNamespace(
        invoke=lambda _p: pipeline._Intent(wants_history=False)
    )
    assistant.retriever = SimpleNamespace(search=lambda *args, **kwargs: [hit])
    assistant.generator = SimpleNamespace(
        write=lambda q, hits, today=None: models.Answer(
            question=q,
            text="You get 25 days.",
            answered=True,
            citations=[
                models.Citation(
                    label=hit.label,
                    quote=hit.content,
                    updated_on=hit.updated_on,
                    status="active",
                    grounded=True,
                )
            ],
        )
    )

    answer = assistant._ask(None, "how many casual leaves", "bob", today=date(2026, 10, 10))
    assert answer.answered is True
    assert answer.fully_grounded is True
    assert "searchable for this user: 31 of 44 chunks" in answer.trace
    assert "attempt 1: top chunk scored 9/10, answering" in answer.trace
    assert len(recorded) == 1
