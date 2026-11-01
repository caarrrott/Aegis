import { useEffect, useState } from "react";
import type { AssistantMessage, UserMessage } from "../lib/chat";
import type { Persona } from "../lib/personas";
import { AnswerBody } from "./AnswerBody";
import { CheckIcon, ChevronIcon, CopyIcon, NoteIcon, ShieldMark } from "./Icons";

const TIME = new Intl.DateTimeFormat(undefined, {
  hour: "numeric",
  minute: "2-digit",
});

function formatTime(at: number): string {
  return TIME.format(at);
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement("textarea");
      area.value = text;
      area.setAttribute("readonly", "");
      area.style.position = "fixed";
      area.style.opacity = "0";
      document.body.appendChild(area);
      area.select();
      const copied = document.execCommand("copy");
      document.body.removeChild(area);
      return copied;
    } catch {
      return false;
    }
  }
}

interface MessageViewProps {
  message: UserMessage | AssistantMessage;
  persona: Persona | undefined;
  onRetry: (message: AssistantMessage) => void;
}

export function MessageView({ message, persona, onRetry }: MessageViewProps) {
  if (message.role === "user") {
    return (
      <article className="message message-user">
        <p className="message-meta">
          <span>{persona?.name ?? "You"}</span>
          <span className="dot" aria-hidden="true" />
          <time dateTime={new Date(message.at).toISOString()}>
            {formatTime(message.at)}
          </time>
        </p>
        <div className="user-bubble">{message.text}</div>
      </article>
    );
  }

  return <AnswerCard message={message} persona={persona} onRetry={onRetry} />;
}

function AnswerCard({
  message,
  persona,
  onRetry,
}: {
  message: AssistantMessage;
  persona: Persona | undefined;
  onRetry: (message: AssistantMessage) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [traceOpen, setTraceOpen] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 1800);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const done = message.status === "done";
  const showRefusal = done && message.answered === false;

  return (
    <article className="message message-answer">
      <header className="answer-head">
        <span className="answer-mark" aria-hidden="true">
          <ShieldMark size={14} />
        </span>
        <span className="answer-author">Aegis</span>
        <span className="answer-dot" aria-hidden="true" />
        <time
          className="answer-time"
          dateTime={new Date(message.at).toISOString()}
        >
          {formatTime(message.at)}
        </time>

        <span className="answer-badges">
          {showRefusal ? (
            <span className="badge badge-warn">Not in policy</span>
          ) : null}
          {done && message.grounded === true ? (
            <span className="badge badge-ok">
              <CheckIcon size={11} />
              Grounded
            </span>
          ) : null}
          {done ? (
            <button
              type="button"
              className="icon-btn copy-btn"
              aria-label={copied ? "Copied" : "Copy answer"}
              title={copied ? "Copied" : "Copy answer"}
              onClick={async () => {
                if (await copyText(message.text)) setCopied(true);
              }}
            >
              {copied ? <CheckIcon size={14} /> : <CopyIcon size={14} />}
            </button>
          ) : null}
        </span>
      </header>

      {message.status === "pending" ? (
        <div className="thinking">
          <span className="thinking-dots" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            Searching the policies {persona?.name ?? "this user"} can read
            <span className="ellipsis" aria-hidden="true">
              …
            </span>
          </span>
        </div>
      ) : null}

      {message.status === "done" ? (
        <>
          {message.text.trim() !== "" ? (
            <AnswerBody text={message.text} />
          ) : (
            <p className="citations-empty">No answer text was returned.</p>
          )}

          {message.warnings.length > 0 ? (
            <div className="warnings" aria-label="Warnings">
              {message.warnings.map((warning) => (
                <p className="warning" key={warning}>
                  <NoteIcon size={14} className="warning-icon" />
                  <span>{warning}</span>
                </p>
              ))}
            </div>
          ) : null}

          <div className="citations">
            <div className="citations-head">
              <span className="label">Sources</span>
              <span className="citations-count">
                {message.citations.length}
              </span>
            </div>
            {message.citations.length > 0 ? (
              <ol className="citation-list">
                {message.citations.map((citation, index) => (
                  <li key={`${citation.label}-${index}`}>
                    <span className="citation-index">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="citation-body">
                      <span className="citation-label">{citation.label}</span>
                      {citation.quote ? (
                        <span className="citation-quote">
                          {citation.quote}
                        </span>
                      ) : null}
                    </span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="citations-empty">No sources were cited.</p>
            )}
          </div>

          {message.trace.length > 0 ? (
            <div className={`trace${traceOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className="trace-toggle"
                aria-expanded={traceOpen}
                onClick={() => setTraceOpen((open) => !open)}
              >
                <span className="label">Trace</span>
                <span className="trace-count">
                  {message.trace.length} step
                  {message.trace.length === 1 ? "" : "s"}
                </span>
                <ChevronIcon size={14} className="trace-chevron" />
              </button>
              {traceOpen ? (
                <ol className="trace-list">
                  {message.trace.map((line, index) => (
                    <li key={`${line}-${index}`}>{line}</li>
                  ))}
                </ol>
              ) : null}
            </div>
          ) : null}
        </>
      ) : null}

      {message.status === "error" || message.status === "cancelled" ? (
        <div
          className={`answer-problem${
            message.status === "cancelled" ? " is-cancelled" : ""
          }`}
        >
          <p className="problem-text">
            <NoteIcon size={15} />
            <span>
              {message.status === "cancelled"
                ? "You stopped this answer."
                : message.error || "Something went wrong while answering."}
            </span>
          </p>
          <button
            type="button"
            className="retry-btn"
            onClick={() => onRetry(message)}
          >
            Ask again
          </button>
        </div>
      ) : null}
    </article>
  );
}
