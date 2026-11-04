"""
Seed the PostgreSQL database with the sample policy documents in `documents/`.

Run with:
    uv run python scripts/seed.py
"""

from assistant import config, ingestion, repository


def main() -> int:
    # Find all sample Markdown policy files in the `documents/` folder
    files = sorted(config.DOCUMENTS_DIR.glob("*.md"))
    if not files:
        print(f"No markdown files found in {config.DOCUMENTS_DIR}")
        return 1

    # Open a pooled database connection, ensure tables exist, and index each file
    with repository.connection() as conn:
        repository.create_schema(conn)
        for path in files:
            text = path.read_text(encoding="utf-8")
            result = ingestion.store(conn, text, path.name)
            print(result.line())
        totals = repository.counts(conn)
        conn.commit()

    print(
        f"Done: {totals['documents']} documents "
        f"({totals['active_documents']} active), {totals['chunks']} chunks."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
