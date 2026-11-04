-- Enable the vector extension before creating tables
CREATE EXTENSION IF NOT EXISTS vector;

-- 1. Users table for access control
CREATE TABLE IF NOT EXISTS users (
    username TEXT PRIMARY KEY,
    display_name TEXT,
    department TEXT NOT NULL,
    is_employee BOOLEAN NOT NULL
);

-- 2. Documents table for policies
CREATE TABLE IF NOT EXISTS documents (
    id BIGSERIAL PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    department TEXT NOT NULL,
    visibility TEXT NOT NULL,
    version INT NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'active',
    effective_from DATE NOT NULL,
    updated_on DATE NOT NULL,
    content_hash TEXT NOT NULL UNIQUE,
    indexed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (title, version)
);

-- 3. Chunks table holding both vectors and keyword indexes
CREATE TABLE IF NOT EXISTS chunks (
    id BIGSERIAL PRIMARY KEY,
    document_id BIGINT NOT NULL REFERENCES documents (id) ON DELETE CASCADE,
    section TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding VECTOR(1536) NOT NULL,
    -- Postgres builds and maintains this itself, so the keyword index can
    -- never drift away from the text it indexes.
    search_text TSVECTOR GENERATED ALWAYS AS (to_tsvector('english', content)) STORED
);

-- Create the HNSW index for vector search and GIN index for keyword search
CREATE INDEX IF NOT EXISTS chunks_embedding_idx
    ON chunks USING hnsw (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS chunks_search_idx
    ON chunks USING gin (search_text);

-- 4. Audit table to record every question asked
CREATE TABLE IF NOT EXISTS audit_events (
    id BIGSERIAL PRIMARY KEY,
    username TEXT NOT NULL,
    question TEXT NOT NULL,
    answered BOOLEAN NOT NULL,
    grounded BOOLEAN NOT NULL,
    sources TEXT NOT NULL,
    at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed the demo users for testing access rules
INSERT INTO users (username, display_name, department, is_employee) VALUES
    ('alice', 'Alice', 'engineering', true),
    ('bob', 'Bob', 'hr', true),
    ('carol', 'Carol', 'finance', true),
    ('guest', 'Guest', 'none', false)
ON CONFLICT (username) DO NOTHING;
