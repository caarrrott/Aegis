"""Data models shared by the Aegis application."""

from dataclasses import dataclass
from datetime import date

@dataclass
class User:
    username: str
    display_name: str
    department: str
    is_employee: bool

    def describe_access(self) -> str:
        if not self.is_employee:
            return "public documents only"
        return (f"public and internal documents, plus restricted "
                f"{self.department} documents")

@dataclass
class Hit:
    """A chunk that came back from search, with where it came from"""
    chunk_id: int
    content: str
    section: str
    source: str
    title: str
    version: int
    status: str
    updated_on: date
    score: float = 0.0 # fusion score first, then the reranker score

    @property
    def label(self) -> str:
        """How this chunk is cited: title, version and section."""
        return f"{self.title} v{self.version} > {self.section}"