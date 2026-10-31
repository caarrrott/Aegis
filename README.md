# Aegis

**Ask questions about company policies and get clear, cited answers.**

Only people who are allowed to see a document can get answers from it. Every answer quotes the exact sentence it came from. Old policies are not treated as current. Every question is logged.

---

A company with departments: HR, finance, engineering, support. Each owns its own documents. Leave policy and compensation belong to HR, reimbursement and discount approvals to finance, error codes and the security policy to engineering, refunds and shipping and warranty to support.

An employee should be able to ask a question in plain language instead of hunting through a shared drive. And the part that makes this a secure assistant:

**NOT EVERYONE MAY READ EVERYTHING**

Someone in HR must not be able to pull engineering's restricted documents, and a guest from outside the company must see almost nothing. In most RAG demos this is skipped. Here it is the centre of the design, which is why access control is applied in SQL before the search runs rather than filtered out afterwards.

A document the user cannot read is never retrieved and never shown to the AI.

## What it does

Employees ask normal questions and receive answers with sources. People from other departments and guests never see restricted files.

- **Access control** — Public, internal, and restricted documents. Guests see only public content. Employees see public + internal + restricted documents from their own department.
- **Exact quotes** — Every claim in the answer must copy a real sentence from the document. Fake quotes are rejected.
- **Versions** — Policies can exist as active and superseded versions. The system uses the correct one.
- **Audit trail** — Every question is saved (who asked, what they asked, which sources were used).

## Quick start

```bash
# Start the database
docker compose up -d

# Set your OpenAI key
cp .env.example .env
# then edit .env and add:
# OPENAI_API_KEY=sk-...
# DATABASE_URL=postgresql://rag:ragsecret@localhost:5433/ragdb

# Run the app
uv run uvicorn assistant.api:app --reload
```

Open http://localhost:8000.

Upload policy files through the web page and ask questions as different users.

### Demo users

| User  | Department  | What they can see                         |
| ----- | ----------- | ----------------------------------------- |
| alice | engineering | Public + internal + engineering-only docs |
| bob   | hr          | Public + internal + HR-only docs          |
| carol | finance     | Public + internal + finance-only docs     |
| guest | none        | Public documents only                     |

## How it works

1. **Check the question** — Is this about the current rule or an older version?
2. **Search** — Look only in the documents this person can read. Combines AI search and keyword search. Access control is applied in the database **before** any search runs.
3. **Pick the best results** — Rank them and drop weak ones.
4. **Write the answer** — Use only the text that was found. Every claim must include an exact quote.
5. **Check the quotes** — Verify every quote really appears in the source (done in code, not by the AI).
6. **Save a log** — Record the question, the user, and the sources used.

## Main features

- **Access control before search** — Restricted documents never leave the database for unauthorized users. This is the centre of the design.
- **Hybrid search** — Combines AI (vector) search and normal keyword search for better results.
- **Better ranking** — A second AI step scores the results and drops low-quality ones.
- **Exact quotes only** — Answers must copy real sentences. Ungrounded claims are rejected.
- **Document versions** — Active and superseded policies can coexist. The system chooses the right one.
- **No duplicate uploads** — Uploading the same content twice does nothing. Changing the content replaces the old version.
- **Audit log** — Every question is saved with who asked it and which sources were used.
- **Trace** — You can see exactly what happened for each question (how many chunks were searchable, what was retrieved, etc.).
- **Warnings** — Old documents or superseded versions trigger a warning on the answer.

## Tech stack

| Part      | What we use                                      |
| --------- | ------------------------------------------------ |
| Language  | Python                                           |
| Web API   | FastAPI + Uvicorn                                |
| AI models | OpenAI (`gpt-4o-mini`, `text-embedding-3-small`) |
| Database  | PostgreSQL 17 + pgvector (Docker)                |
| Search    | Hybrid (vector + keyword)                        |
| Website   | One simple HTML page                             |

## How to format a policy file

Every uploaded file must start with this header:

```markdown
---
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
...
```

- **visibility**: `public`, `internal`, or `restricted`
- **status**: `active` or `superseded`
- Title + version is the document’s identity

Department examples:
- HR → leave policy, compensation
- Finance → reimbursement, discount approvals
- Engineering → error codes, security policy
- Support → refunds, shipping, warranty

## Folder structure

```
.
├── docker-compose.yml # Starts Postgres + pgvector
├── schema.sql # Creates tables and demo users
├── assistant/
│ ├── config.py # All settings in one place
│ ├── models.py # Data shapes used by the system
│ ├── ingestion.py # Handles file uploads (parse, split, embed)
│ ├── repository.py # All database queries
│ ├── retrieval.py # Search + ranking
│ ├── generation.py # Writes answers and checks quotes
│ ├── pipeline.py # Runs the full process
│ └── api.py # Web endpoints
├── prompts/ # AI instructions (plain text files)
└── web/index.html # Upload + chat page
```

## Who can see what

| Visibility | Who can read it                |
| ---------- | ------------------------------ |
| public     | Anyone (including guests)      |
| internal   | Any employee                   |
| restricted | Only people in that department |

This check happens in the database before search. The AI never sees documents the user is not allowed to read.

## API endpoints

| Method | Path         | What it does                   |
| ------ | ------------ | ------------------------------ |
| GET    | `/`          | Opens the web page             |
| GET    | `/health`    | Checks if the database is up   |
| GET    | `/documents` | Lists uploaded documents       |
| POST   | `/documents` | Upload and index a policy file |
| POST   | `/ask`       | Ask a question as a given user |

## License

MIT
