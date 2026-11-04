# Aegis — Demo & Test Guide

A step-by-step guide to running Aegis and verifying the core value of the
product: **answers are grounded in the documents you are allowed to read, and
nothing else.**

---

## 1. Prerequisites

- Docker (for Postgres + pgvector)
- [uv](https://docs.astral.sh/uv/) (Python environment)
- An OpenAI API key

## 2. Start the stack

```bash
# 1. Database (Postgres 17 + pgvector)
docker compose up -d

# 2. Configure environment (only the OpenAI key needs editing)
cp .env.example .env
#   edit .env → OPENAI_API_KEY=sk-...

# 3. Install and run the API (serves the UI at http://localhost:8000)
uv sync
uv run uvicorn assistant.api:app --reload
```

Open **http://localhost:8000**. The header pill should turn green and read
`Connected`.

> If Postgres reports `password authentication failed`, the data volume was
> initialized with different credentials. Reset it:
> `docker compose down -v && docker compose up -d`

## 3. Index the sample policies

The `documents/` folder ships with nine policy files across HR, finance,
engineering and support. Upload them through the **Knowledge library** panel
(drag-and-drop or browse), or index everything at once:

```bash
uv run python scripts/seed.py
```

Expected result: the library list shows documents with **Active /
Superseded** and **Public / Internal / Restricted** badges.

## 4. Demo script (ask as different users)

The persona switcher (top-right) changes *who is asking*, which changes what
the assistant may retrieve — **before** search runs.

| # | Question | User | Expected |
|---|----------|------|----------|
| 1 | “What is the refund policy?” | **Guest** | Answered from the **public** support policy. |
| 2 | “How much annual leave do I get?” | **Guest** | Refused — leave policy is **internal**. |
| 3 | “How much annual leave do I get?” | **Alice** | Answered from Leave Policy **v2 (active)**, not the superseded v1. |
| 4 | “What was the previous leave allowance?” | **Alice** | Quotes the **superseded** v1, with a warning that it is history. |
| 5 | “How do I get production database access?” | **Bob** | Refused — Security Policy is **engineering restricted**. |
| 6 | “How do I get production database access?” | **Alice** | Answered with a **verified** quote from the Security Policy. |
| 7 | “What is the travel reimbursement policy?” | **Carol** | Answered from Travel **v3 (active)**, not v2. |

Key things to confirm in the UI:

- Every answer shows a **✓ DETERMINISTICALLY VERIFIED QUOTE** and the source
  file with its access tier.
- A **superseded** source triggers an amber warning.
- A question the user may not answer returns an honest
  **“No reliable answer”** state rather than a guess.

## 5. API checks (curl)

```bash
# Health + counts
curl -s http://localhost:8000/health

# List indexed documents
curl -s http://localhost:8000/documents

# Ask as Alice (engineering) — should answer from Security Policy
curl -s -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How do I get production access?","username":"alice"}'

# Same question as Guest — should refuse
curl -s -X POST http://localhost:8000/ask \
  -H "Content-Type: application/json" \
  -d '{"question":"How do I get production access?","username":"guest"}'

# Upload a policy file
curl -s -X POST http://localhost:8000/documents \
  -F "file=@documents/hr-leave-policy-v2.md"
```

## 6. Manual test checklist

- [ ] Header shows `Connected` and live doc/passage counts.
- [ ] Uploading the same content twice is skipped (no duplicate).
- [ ] Re-uploading a changed file replaces that version.
- [ ] Switching persona updates the composer **Scope** pill and header role badge.
- [ ] Dark/light theme toggle works and is remembered on reload.
- [ ] Mobile (< 768px): sidebar opens as a drawer via the menu button.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `password authentication failed` | `docker compose down -v && docker compose up -d` |
| Header stuck on “Offline” | Confirm uvicorn is running and Postgres is healthy: `docker compose ps` |
| No answer / “Server offline” | Check `OPENAI_API_KEY` is set and valid in `.env` |
| UI changes not showing | Hard-refresh the browser (Ctrl+Shift+R) |
