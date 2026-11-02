import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  askQuestion,
  fetchDocuments,
  fetchHealth,
  uploadDocument,
  type PolicyDocument,
} from "./lib/api";
import {
  uid,
  type AssistantMessage,
  type ChatMessage,
  type UserMessage,
} from "./lib/chat";
import { PERSONAS } from "./lib/personas";
import type { UploadTask } from "./lib/uploads";
import { applyTheme, initialTheme, persistTheme, type Theme } from "./lib/theme";
import { Composer } from "./components/Composer";
import { EmptyState } from "./components/EmptyState";
import {
  DocIcon,
  MenuIcon,
  MoonIcon,
  PlusIcon,
  SunIcon,
} from "./components/Icons";
import { Library } from "./components/Library";
import { MessageView } from "./components/MessageView";
import { Sidebar } from "./components/Sidebar";

const MAX_UPLOAD_ROWS = 6;

function describeError(error: unknown): string {
  if (error instanceof TypeError) {
    return "Could not reach the Aegis server. Check that it is running, then try again.";
  }
  if (error instanceof Error && error.message.trim() !== "") {
    return error.message;
  }
  return "Something went wrong. Please try again.";
}

export default function App() {
  const [theme, setTheme] = useState<Theme>(() => initialTheme());
  const [activeId, setActiveId] = useState(PERSONAS[0].id);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [online, setOnline] = useState<boolean | null>(null);

  const [navOpen, setNavOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const [documents, setDocuments] = useState<PolicyDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadTask[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const inFlight = useRef(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const persona = useMemo(
    () => PERSONAS.find((item) => item.id === activeId) ?? PERSONAS[0],
    [activeId],
  );

  /* Connection ---------------------------------------------------------- */
  useEffect(() => {
    let alive = true;

    async function check() {
      const ok = await fetchHealth();
      if (alive) setOnline(ok);
    }

    void check();
    const timer = window.setInterval(check, 30_000);
    return () => {
      alive = false;
      window.clearInterval(timer);
    };
  }, []);

  /* Theme --------------------------------------------------------------- */
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const chooseTheme = useCallback((next: Theme) => {
    setTheme(next);
    persistTheme(next);
  }, []);

  /* Documents ----------------------------------------------------------- */
  const loadDocuments = useCallback(async () => {
    setDocumentsLoading(true);
    try {
      const list = await fetchDocuments();
      setDocuments(list);
      setDocumentsError(null);
    } catch (error) {
      setDocumentsError(
        error instanceof Error ? error.message : "Could not load documents.",
      );
    } finally {
      setDocumentsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  const openLibrary = useCallback(() => {
    setLibraryOpen(true);
    void loadDocuments();
  }, [loadDocuments]);

  /* Conversation -------------------------------------------------------- */
  const ask = useCallback(
    async (raw: string, personaOverride?: string) => {
      const text = raw.trim();
      if (text === "" || inFlight.current) return;

      const personaId = personaOverride ?? activeId;
      const speaker = PERSONAS.find((item) => item.id === personaId) ?? PERSONAS[0];

      const userMessage: UserMessage = {
        id: uid(),
        role: "user",
        personaId: speaker.id,
        text,
        at: Date.now(),
      };

      const answerId = uid();
      const placeholder: AssistantMessage = {
        id: answerId,
        role: "assistant",
        status: "pending",
        question: text,
        personaId: speaker.id,
        text: "",
        answered: null,
        grounded: null,
        citations: [],
        warnings: [],
        trace: [],
        at: Date.now(),
      };

      setMessages((current) => [...current, userMessage, placeholder]);
      setDraft("");
      setPending(true);
      inFlight.current = true;

      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const result = await askQuestion(speaker.id, text, controller.signal);
        setMessages((current) =>
          current.map((message) =>
            message.id === answerId
              ? {
                  ...message,
                  status: "done",
                  text: result.answer,
                  answered: result.answered,
                  grounded: result.grounded,
                  citations: result.citations,
                  warnings: result.warnings,
                  trace: result.trace,
                }
              : message,
          ),
        );
      } catch (error) {
        const cancelled = controller.signal.aborted;
        setMessages((current) =>
          current.map((message) =>
            message.id === answerId
              ? {
                  ...message,
                  status: cancelled ? "cancelled" : "error",
                  error: describeError(error),
                }
              : message,
          ),
        );
      } finally {
        if (abortRef.current === controller) abortRef.current = null;
        inFlight.current = false;
        setPending(false);
      }
    },
    [activeId],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const clearConversation = useCallback(() => {
    abortRef.current?.abort();
    inFlight.current = false;
    setPending(false);
    setMessages([]);
    setDraft("");
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  const retry = useCallback(
    (message: AssistantMessage) => {
      setActiveId(message.personaId);
      void ask(message.question, message.personaId);
    },
    [ask],
  );

  const pickSuggestion = useCallback((question: string) => {
    setDraft(question);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && navOpen) setNavOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [navOpen]);

  useEffect(() => () => abortRef.current?.abort(), []);

  /* Uploads ------------------------------------------------------------- */
  const handleUploadFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return;

      const tasks: UploadTask[] = files.map((file) => ({
        id: uid(),
        filename: file.name,
        status: "uploading",
      }));

      setUploads((current) => [...tasks, ...current].slice(0, MAX_UPLOAD_ROWS));

      for (let index = 0; index < files.length; index += 1) {
        const file = files[index];
        const task = tasks[index];

        try {
          const result = await uploadDocument(file);
          const parts = [
            result.title,
            result.version !== undefined ? `v${result.version}` : undefined,
            result.chunks !== undefined
              ? `${result.chunks} chunk${result.chunks === 1 ? "" : "s"}`
              : undefined,
            result.outcome,
            result.message,
          ].filter((part): part is string => Boolean(part));

          setUploads((current) =>
            current.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status: "done",
                    detail: parts.length > 0 ? parts.join(" · ") : "Indexed",
                  }
                : item,
            ),
          );
        } catch (error) {
          setUploads((current) =>
            current.map((item) =>
              item.id === task.id
                ? {
                    ...item,
                    status: "error",
                    error: describeError(error),
                  }
                : item,
            ),
          );
        }
      }

      void loadDocuments();
    },
    [loadDocuments],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="app">
      <div
        className={`nav-scrim${navOpen ? " is-open" : ""}`}
        onClick={() => setNavOpen(false)}
        aria-hidden="true"
      />

      <Sidebar
        online={online}
        documentCount={
          documentsLoading && documents.length === 0 ? null : documents.length
        }
        onOpenLibrary={openLibrary}
        open={navOpen}
        onClose={() => setNavOpen(false)}
      />

      <main className="main">
        <header className="topbar">
          <div className="topbar-side">
            <button
              type="button"
              className="icon-btn menu-btn only-mobile"
              onClick={() => setNavOpen(true)}
              aria-label="Open menu"
            >
              <MenuIcon />
            </button>
            <div className="topbar-copy">
              <p className="label">Company workspace</p>
              <h1 className="topbar-title">
                Policy assistant
              </h1>
            </div>
          </div>

          <div className="topbar-actions">
            <div
              className="theme-toggle"
              role="group"
              aria-label="Color theme"
              title="Switch between daylight and night themes"
            >
              <button
                type="button"
                className={`theme-option${
                  theme === "light" ? " is-active" : ""
                }`}
                aria-pressed={theme === "light"}
                aria-label="Daylight theme"
                onClick={() => chooseTheme("light")}
              >
                <SunIcon size={13} />
              </button>
              <button
                type="button"
                className={`theme-option${theme === "dark" ? " is-active" : ""}`}
                aria-pressed={theme === "dark"}
                aria-label="Night theme"
                onClick={() => chooseTheme("dark")}
              >
                <MoonIcon size={13} />
              </button>
            </div>

            <span
              className={`health${
                online === null ? " is-idle" : online ? "" : " is-offline"
              }`}
              role="status"
              title={
                online === null
                  ? "Checking the connection"
                  : online
                    ? "The Aegis server is responding"
                    : "The Aegis server is not responding"
              }
            >
              <span className="health-dot" aria-hidden="true" />
              <span className="health-text">
                {online === null ? "Checking" : online ? "Live" : "Offline"}
              </span>
            </span>

            <button
              type="button"
              className="ghost-btn"
              onClick={openLibrary}
            >
              <DocIcon size={15} />
              <span className="ghost-label">Library</span>
              <span className="ghost-count">{documents.length}</span>
            </button>

            <button
              type="button"
              className="ghost-btn ghost-btn-quiet"
              onClick={clearConversation}
              disabled={!hasMessages && draft === ""}
            >
              <PlusIcon size={15} />
              <span className="ghost-label">New</span>
            </button>
          </div>
        </header>

        <div className="thread" role="log" aria-live="polite">
          <div className={`thread-inner${messages.length === 0 ? " is-empty" : ""}`}>
            {messages.length === 0 ? (
              <EmptyState persona={persona} onPick={pickSuggestion} />
            ) : (
              messages.map((message) => (
                <MessageView
                  key={message.id}
                  message={message}
                  persona={PERSONAS.find(
                    (item) => item.id === message.personaId,
                  )}
                  onRetry={retry}
                />
              ))
            )}
            <div ref={endRef} className="thread-end" />
          </div>
        </div>

        <Composer
          draft={draft}
          onDraftChange={setDraft}
          onSubmit={() => void ask(draft)}
          onStop={stop}
          pending={pending}
          persona={persona}
          textareaRef={textareaRef}
        />
      </main>

      <Library
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        documents={documents}
        loading={documentsLoading}
        error={documentsError}
        onRefresh={() => void loadDocuments()}
        onUploadFiles={(files) => void handleUploadFiles(files)}
        uploads={uploads}
        onClearUploads={() => setUploads([])}
      />
    </div>
  );
}
