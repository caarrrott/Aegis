"""
Data models shared by the Aegis application.

`models.py` holds plain Python dataclasses, not Pydantic models, and not
database rows. These are the data shapes that travel between layers:
    - User           -> who is asking and what permissions they have
    - SourceDocument -> a parsed Markdown policy file ready to be split and stored
    - Chunk          -> one section/piece of a document before embedding
    - Hit            -> a chunk returned from database search with its score
    - Citation       -> an exact sentence quoted by the LLM and checked in Python
    - Answer         -> the final answer text, citations, warnings, and trace
"""

from dataclasses import dataclass, field
from datetime import date


@dataclass
class User:
    """Represents the person asking a question and their department permissions."""

    username: str      # e.g. 'alice', 'bob', 'carol', or 'guest'
    display_name: str  # e.g. 'Alice', 'Bob', 'Carol', or 'Guest'
    department: str    # e.g. 'engineering', 'hr', 'finance', or 'none'
    is_employee: bool  # True for employees, False for external guests

    def describe_access(self) -> str:
        """Human-readable summary of what this user can read, shown in the trace."""
        if not self.is_employee:
            return "public documents only"
        return (
            f"public and internal documents, plus restricted "
            f"{self.department} documents"
        )


@dataclass
class SourceDocument:
    """A policy file parsed into its frontmatter metadata fields and Markdown body."""

    source: str          # Original uploaded filename
    title: str           # Policy title from header
    department: str      # Owning department ('hr', 'engineering', 'finance', 'support')
    visibility: str      # 'public', 'internal', or 'restricted'
    version: int         # Version number (1, 2, 3...)
    status: str          # 'active' or 'superseded'
    effective_from: date # Date policy took effect
    updated_on: date     # Date policy was last reviewed (used for freshness warnings)
    content_hash: str    # SHA-256 fingerprint of the file content for deduplication
    body: str            # Markdown text below the `---` header block


@dataclass
class Chunk:
    """One piece of a policy document produced by splitting on headings and size."""

    section: str  # The `##` heading name (or document title if no heading)
    content: str  # The text of the chunk that gets embedded and searched


@dataclass
class Hit:
    """A chunk that came back from search, with where it came from."""

    chunk_id: int
    content: str
    section: str
    source: str
    title: str
    version: int
    status: str
    updated_on: date
    score: float = 0.0  # fusion score first, then the reranker score

    @property
    def label(self) -> str:
        """How this chunk is cited: title, version and section."""
        return f"{self.title} v{self.version} > {self.section}"


@dataclass
class Citation:
    """A single claim's source label and quoted sentence, plus whether Python verified it."""

    label: str        # e.g. 'Leave policy v1 > How many leaves'
    quote: str        # Exact sentence copied by the LLM
    updated_on: date  # Review date of the cited document
    status: str       # 'active' or 'superseded'
    grounded: bool    # True if `quote` actually appears in the chunk text


@dataclass
class Answer:
    """The final output returned by the pipeline to the API and UI."""

    question: str
    text: str
    answered: bool
    citations: list[Citation] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    trace: list[str] = field(default_factory=list)

    @property
    def fully_grounded(self) -> bool:
        """True when there is at least one citation and every citation is grounded in its chunk."""
        return bool(self.citations) and all(c.grounded for c in self.citations)
