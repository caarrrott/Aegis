"""
Indexing one uploaded document.

Nothing is indexed until somebody uploads it. There is no folder that gets
scanned, because in a real company documents arrive one at a time, from people,
with whatever file name they happened to have.

So a document is identified by what it says, not by what it is called:

    same text, any file name     already indexed, nothing to do, nothing to pay
    same policy and version,
    different text               an edit, so the old chunks are replaced
    new policy or new version    indexed as a new document

That is why the content hash is unique in the database and the file name is
not. policy.md, policy-final.md and policy(2).md with the same text are one
document.
"""

import hashlib
from dataclasses import dataclass
from datetime import datetime

from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import MarkdownHeaderTextSplitter, RecursiveCharacterTextSplitter

from assistant import config, repository
from assistant.models import Chunk, SourceDocument

# Every uploaded policy file must have these 7 fields in its top `---` header block
REQUIRED_FIELDS = (
    "title",
    "department",
    "visibility",
    "version",
    "status",
    "effective",
    "updated",
)


@dataclass
class UploadResult:
    """What happened to one uploaded file."""

    filename: str
    outcome: str  # added, updated, duplicate
    title: str = ""
    version: int = 0
    chunks: int = 0
    detail: str = ""

    def line(self) -> str:
        """Format a single status line describing the upload result."""
        if self.outcome == "duplicate":
            return f"{self.filename}: already indexed as {self.detail}, skipped"
        return (
            f"{self.filename}: {self.outcome} as {self.title} v{self.version}, "
            f"{self.chunks} chunks"
        )


class UploadError(ValueError):
    """The file cannot be indexed, with a reason a person can act on."""


def parse(text: str, filename: str) -> SourceDocument:
    """Read the header block and the body out of an uploaded markdown file.

    Line endings are normalised before anything else. A file saved on Windows
    carries \\r\\n and the same file from a Mac carries \\n, and without this
    line those two would hash differently and be indexed twice.
    """
    # 1. Normalize line endings so Windows (\r\n) and Mac/Linux (\n) hash identically
    text = text.replace("\r\n", "\n").replace("\r", "\n")

    # 2. Verify the file starts with a `---` frontmatter header block
    if not text.lstrip().startswith("---"):
        raise UploadError("the file must start with a header block between --- markers")

    parts = text.split("---", 2)
    if len(parts) < 3:
        raise UploadError("the file must start with a header block between --- markers")
    _, header, body = parts

    # 3. Parse `key: value` lines from the header block
    fields = {}
    for line in header.strip().splitlines():
        if ":" not in line:
            continue
        key, value = line.split(":", 1)
        fields[key.strip()] = value.strip()

    # 4. Check that all 7 required metadata fields are present
    missing = [field for field in REQUIRED_FIELDS if not fields.get(field)]
    if missing:
        raise UploadError("the header is missing: " + ", ".join(missing))

    try:
        version = int(fields["version"])
    except ValueError as error:
        raise UploadError("version must be a whole number") from error

    try:
        effective_from = datetime.strptime(fields["effective"], "%Y-%m-%d").date()
        updated_on = datetime.strptime(fields["updated"], "%Y-%m-%d").date()
    except ValueError as error:
        raise UploadError("effective and updated dates must be YYYY-MM-DD") from error

    # 5. Build the SourceDocument with a SHA-256 fingerprint of the full normalized text
    return SourceDocument(
        source=filename,
        title=fields["title"],
        department=fields["department"],
        visibility=fields["visibility"],
        version=version,
        status=fields["status"],
        effective_from=effective_from,
        updated_on=updated_on,
        content_hash=hashlib.sha256(text.encode("utf-8")).hexdigest(),
        body=body.strip(),
    )


def split(document: SourceDocument) -> list[Chunk]:
    """Split on headings first, then on size."""
    # Pass 1: Split the Markdown body on `##` section headings so each chunk knows its section name
    by_heading = MarkdownHeaderTextSplitter(headers_to_split_on=[("##", "section")])
    # Pass 2: Split any long section into pieces of at most CHUNK_SIZE (600) with CHUNK_OVERLAP (120)
    by_size = RecursiveCharacterTextSplitter(
        chunk_size=config.CHUNK_SIZE, chunk_overlap=config.CHUNK_OVERLAP
    )

    chunks = []
    for section in by_heading.split_text(document.body):
        # Use the `##` heading name if present, or fall back to the document title
        name = section.metadata.get("section", document.title)
        for piece in by_size.split_text(section.page_content):
            chunks.append(Chunk(section=name, content=piece))

    return chunks


def store(connection, text: str, filename: str) -> UploadResult:
    """Index one uploaded file. The only way documents enter this system."""
    # Step 1: Parse the header metadata and body
    document = parse(text, filename)

    # Step 2: Same text, under any name. Nothing to do, and nothing to pay for.
    existing = repository.find_by_hash(connection, document.content_hash)
    if existing:
        return UploadResult(
            filename=filename,
            outcome="duplicate",
            title=existing["title"],
            version=existing["version"],
            detail=f"{existing['title']} v{existing['version']} (from {existing['source']})",
        )

    # Step 3: Same policy and version, different text. This is an edit, so the old
    # chunks go and the new ones take their place.
    replacing = repository.find_by_version(connection, document.title, document.version)
    if replacing:
        repository.delete_document(connection, replacing["id"])

    # Step 4: Split into chunks by heading and size
    chunks = split(document)
    if not chunks:
        raise UploadError("the document has no content under its headings")

    # Step 5: Compute vector embeddings for all chunks in one batch API call
    vectors = OpenAIEmbeddings(model=config.EMBEDDING_MODEL).embed_documents(
        [chunk.content for chunk in chunks]
    )

    # Step 6: Insert the document row and its chunk rows, then commit the transaction
    document_id = repository.insert_document(connection, document)
    repository.insert_chunks(
        connection,
        document_id,
        [chunk.section for chunk in chunks],
        [chunk.content for chunk in chunks],
        vectors,
    )
    connection.commit()

    return UploadResult(
        filename=filename,
        outcome="updated" if replacing else "added",
        title=document.title,
        version=document.version,
        chunks=len(chunks),
    )
