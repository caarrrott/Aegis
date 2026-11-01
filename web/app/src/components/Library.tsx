import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import type { PolicyDocument } from "../lib/api";
import type { UploadTask } from "../lib/uploads";
import {
  CheckIcon,
  CloseIcon,
  DocIcon,
  NoteIcon,
  RefreshIcon,
  UploadIcon,
} from "./Icons";

interface LibraryProps {
  open: boolean;
  onClose: () => void;
  documents: PolicyDocument[];
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
  onUploadFiles: (files: File[]) => void;
  uploads: UploadTask[];
  onClearUploads: () => void;
}

const ACCEPT = ".md,.markdown,.txt,text/markdown,text/plain";

const DEPARTMENT_NAMES: Record<string, string> = {
  hr: "HR",
  finance: "Finance",
  engineering: "Engineering",
  support: "Support",
};

function departmentName(value: string): string {
  const key = value.trim().toLowerCase();
  if (DEPARTMENT_NAMES[key]) return DEPARTMENT_NAMES[key];
  return key.charAt(0).toUpperCase() + key.slice(1);
}

export function Library({
  open,
  onClose,
  documents,
  loading,
  error,
  onRefresh,
  onUploadFiles,
  uploads,
  onClearUploads,
}: LibraryProps) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!open) return;

    closeRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose]);

  if (!open) return null;

  const restricted = documents.filter(
    (document) => document.visibility === "restricted",
  ).length;

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    onUploadFiles(Array.from(files));
  }

  function handleInput(event: ChangeEvent<HTMLInputElement>) {
    handleFiles(event.target.files);
    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  return (
    <div className="library-layer">
      <div className="library-scrim" onClick={onClose} aria-hidden="true" />

      <aside
        className="library"
        role="dialog"
        aria-modal="true"
        aria-labelledby="library-title"
      >
        <header className="library-head">
          <div>
            <p className="label">Policy library</p>
            <h2 id="library-title" className="library-heading">
              Documents
            </h2>
          </div>
          <button
            type="button"
            ref={closeRef}
            className="icon-btn"
            onClick={onClose}
            aria-label="Close library"
          >
            <CloseIcon />
          </button>
        </header>

        <div className="library-scroll">
          <div
            className={`dropzone${dragging ? " is-dragging" : ""}`}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={(event) => {
              const next = event.relatedTarget;
              if (next instanceof Node && event.currentTarget.contains(next)) return;
              setDragging(false);
            }}
            onDrop={handleDrop}
          >
            <span className="dropzone-mark" aria-hidden="true">
              <UploadIcon size={20} />
            </span>
            <p className="dropzone-title">
              {dragging ? "Release to index" : "Drop a policy file"}
            </p>
            <p className="dropzone-sub">
              Markdown or text, with the front-matter header.{" "}
              <button
                type="button"
                className="text-btn"
                onClick={() => fileRef.current?.click()}
              >
                Browse files
              </button>
            </p>
            <input
              ref={fileRef}
              type="file"
              className="sr-only"
              accept={ACCEPT}
              multiple
              onChange={handleInput}
            />
          </div>

          {uploads.length > 0 ? (
            <section className="uploads" aria-label="Recent uploads">
              <div className="section-row">
                <span className="label">Recent uploads</span>
                <button type="button" className="text-btn" onClick={onClearUploads}>
                  Clear
                </button>
              </div>
              <ul>
                {uploads.map((task) => (
                  <li key={task.id} className={`upload upload-${task.status}`}>
                    <span className="upload-state" aria-hidden="true">
                      {task.status === "uploading" ? (
                        <span className="spinner" />
                      ) : task.status === "done" ? (
                        <CheckIcon size={13} />
                      ) : (
                        <NoteIcon size={13} />
                      )}
                    </span>
                    <span className="upload-copy">
                      <span className="upload-name">{task.filename}</span>
                      <span className="upload-detail">
                        {task.status === "uploading"
                          ? "Indexing…"
                          : task.status === "done"
                            ? task.detail || "Indexed"
                            : task.error || "Upload failed."}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="docs" aria-label="Indexed documents">
            <div className="section-row docs-head">
              <span className="label">Indexed</span>
              <span className="docs-count">{documents.length}</span>
              <button
                type="button"
                className={`icon-btn refresh-btn${loading ? " is-loading" : ""}`}
                onClick={onRefresh}
                aria-label="Refresh documents"
                title="Refresh documents"
              >
                <RefreshIcon size={15} />
              </button>
            </div>

            {error ? (
              <p className="library-error">
                <NoteIcon size={14} />
                <span>{error}</span>
              </p>
            ) : null}

            {documents.length > 0 ? (
              <ul className="doc-list">
                {documents.map((document, index) => (
                  <li
                    key={`${document.id ?? document.title}-${index}`}
                    className="doc"
                  >
                    <span className="doc-glyph" aria-hidden="true">
                      <DocIcon size={15} />
                    </span>
                    <div className="doc-main">
                      <div className="doc-title-row">
                        <h3 className="doc-title">{document.title}</h3>
                        {document.version !== undefined ? (
                          <span className="doc-version">v{document.version}</span>
                        ) : null}
                      </div>
                      <div className="doc-meta">
                        {document.department ? (
                          <span className="chip">
                            {departmentName(document.department)}
                          </span>
                        ) : null}
                        {document.visibility ? (
                          <span className={`chip chip-${document.visibility}`}>
                            {document.visibility}
                          </span>
                        ) : null}
                        {document.status === "superseded" ? (
                          <span className="chip chip-warn">superseded</span>
                        ) : null}
                        {document.chunks !== undefined ? (
                          <span className="doc-dim">
                            {document.chunks} chunk
                            {document.chunks === 1 ? "" : "s"}
                          </span>
                        ) : null}
                        {document.updated ? (
                          <span className="doc-dim">{document.updated}</span>
                        ) : null}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="library-empty">
                <span className="library-empty-mark" aria-hidden="true">
                  <DocIcon size={20} />
                </span>
                <h3>Nothing indexed yet</h3>
                <p>
                  Upload a policy to give Aegis something to read. Every file
                  starts with a header block:
                </p>
                <pre>{`title: Leave policy
department: hr
visibility: internal
version: 1
status: active`}</pre>
              </div>
            )}
          </section>
        </div>

        <footer className="library-foot">
          <span>
            {documents.length} document{documents.length === 1 ? "" : "s"}
          </span>
          <span className="library-foot-sep" aria-hidden="true" />
          <span>{restricted} restricted</span>
          <span className="library-foot-spacer" />
          <span className="library-foot-note">Access is applied in SQL</span>
        </footer>
      </aside>
    </div>
  );
}
