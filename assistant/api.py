"""
The HTTP layer. Four endpoints, no business logic.

    GET    /             the web page
    GET    /health       is the database up, and what is in it
    GET    /documents    what has been uploaded so far
    POST   /documents    upload a document, which indexes it
    POST   /ask          {"question": "...", "username": "alice"}

The user arrives here from the request because this is a class project. In a
real deployment it comes from the session or the access token, and nothing
below this file changes.
"""

from contextlib import asynccontextmanager
from datetime import UTC, datetime

from fastapi import FastAPI, HTTPException, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

from assistant import config, ingestion, repository
from assistant.pipeline import Assistant

# Application state populated at server startup
state: dict = {}


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Open the pool and make sure the tables exist, once."""
    with repository.connection() as connection:
        repository.create_schema(connection)

    state["assistant"] = Assistant()
    state["started_at"] = datetime.now(UTC)
    yield
    repository.close_pool()


app = FastAPI(title="Secure Enterprise RAG Assistant", lifespan=lifespan)


class AskRequest(BaseModel):
    """Request payload for asking a question as a user."""

    question: str = Field(min_length=3)
    username: str = "guest"


@app.get("/health")
def health() -> dict:
    """Check if the database is up and return current document and chunk counts."""
    with repository.connection() as connection:
        # started_at tells you whether you are talking to the server you just
        # started, or to an older one still holding the port.
        started_at = state.get("started_at") or datetime.now(UTC)
        return {
            "status": "ok",
            "started_at": started_at.isoformat(timespec="seconds"),
            **repository.counts(connection),
        }


@app.get("/documents")
def documents() -> dict:
    """Return the list of uploaded policy documents."""
    with repository.connection() as connection:
        return {"documents": repository.list_documents(connection)}


@app.post("/documents")
async def upload(file: UploadFile) -> dict:
    """Read an uploaded Markdown policy file, index it into Postgres, and return the outcome."""
    text = (await file.read()).decode("utf-8", errors="replace")

    with repository.connection() as connection:
        try:
            result = ingestion.store(connection, text, file.filename or "policy.md")
        except ingestion.UploadError as error:
            raise HTTPException(status_code=400, detail=str(error)) from error

        return {
            "outcome": result.outcome,
            "title": result.title,
            "version": result.version,
            "message": result.line(),
            **repository.counts(connection),
        }


@app.post("/ask")
def ask(request: AskRequest) -> dict:
    """Run the RAG pipeline for the user's question and return the answer, citations, warnings, and trace."""
    assistant = state.get("assistant") or Assistant()
    answer = assistant.ask(request.question, username=request.username)

    return {
        "question": answer.question,
        "answer": answer.text,
        "answered": answer.answered,
        "grounded": answer.fully_grounded,
        "citations": [
            {
                "source": citation.label,
                "quote": citation.quote,
                "updated_on": str(citation.updated_on),
                "status": citation.status,
                "grounded": citation.grounded,
            }
            for citation in answer.citations
        ],
        "warnings": answer.warnings,
        "trace": answer.trace,
    }


@app.get("/")
def home() -> FileResponse:
    """Serve the web client."""
    return FileResponse(config.ROOT / "web" / "index.html")
