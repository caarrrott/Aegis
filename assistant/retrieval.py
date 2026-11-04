"""
Retrieval, the half of RAG that runs per question.

    embed the question  ->  hybrid search in Postgres  ->  rerank  ->  cut

The search itself is one SQL statement in the repository, and it already does
access control and rank fusion. This layer adds the second pass.

Why rerank at all: a chunk was embedded long before anyone asked a question, so
its vector has to represent that chunk for every possible question at once. The
reranker sees the question and the chunk together, which is a much easier
judgement, and it is the cheapest large quality gain in a RAG system.

Why cut below a score: taking the best four blindly would pass a chunk the
reranker called useless straight into the prompt, which is exactly what we were
trying to avoid.
"""

from langchain_openai import ChatOpenAI, OpenAIEmbeddings
from pydantic import BaseModel, Field

from assistant import config, repository
from assistant.models import Hit, User


# Structured rating for a single candidate chunk (index 1..N and score 0..10)
class _Rating(BaseModel):
    index: int = Field(description="Number of the chunk being rated")
    score: int = Field(description="0 means useless, 10 means it fully answers the question")


# Structured list of ratings returned by the reranker LLM
class _Ratings(BaseModel):
    ratings: list[_Rating] = Field(description="One rating per candidate")


class Retriever:
    """Hybrid search with reranking, inside one caller's permissions."""

    def __init__(self):
        # Convert the user's question into a 1,536-dimensional embedding vector
        self.embeddings = OpenAIEmbeddings(model=config.EMBEDDING_MODEL)
        # LLM reranker configured to return structured `_Ratings`
        self.reranker = ChatOpenAI(
            model=config.HELPER_MODEL, temperature=0
        ).with_structured_output(_Ratings)

    def search(
        self, connection, question: str, user: User, include_history: bool = False
    ) -> list[Hit]:
        """The connection is passed in, so it can come from the pool per request."""
        # Step 1: Embed the user's question
        query_vector = self.embeddings.embed_query(question)

        # Step 2: Run hybrid search (vector + keyword + permissions) in PostgreSQL
        candidates = repository.hybrid_search(
            connection, question, query_vector, user, include_history
        )
        if not candidates:
            return []

        # Step 3: Rerank the candidates with the LLM and filter out low scores
        return self._rerank(question, candidates)

    def _rerank(self, question: str, candidates: list[Hit]) -> list[Hit]:
        # Format candidates as a 1-based numbered list with single-line whitespace
        numbered = "\n".join(
            f"[{number}] {' '.join(hit.content.split())}"
            for number, hit in enumerate(candidates, start=1)
        )

        # Ask the reranker LLM to rate every candidate chunk from 0 to 10
        result = self.reranker.invoke(
            config.prompt("rerank").format(question=question, candidates=numbered)
        )

        # Attach each 0-10 score to its corresponding Hit object
        scored = []
        for rating in result.ratings:
            if 1 <= rating.index <= len(candidates):
                hit = candidates[rating.index - 1]
                hit.score = rating.score
                scored.append(hit)

        # Sort highest score first and keep at most TOP_K (4) chunks scoring >= MIN_RERANK_SCORE (4)
        scored.sort(key=lambda hit: hit.score, reverse=True)
        return [hit for hit in scored[: config.TOP_K] if hit.score >= config.MIN_RERANK_SCORE]
