import { useEffect, type KeyboardEvent, type RefObject } from "react";
import type { Persona } from "../lib/personas";
import { ArrowUpIcon, StopIcon } from "./Icons";

interface ComposerProps {
  draft: string;
  onDraftChange: (value: string) => void;
  onSubmit: () => void;
  onStop: () => void;
  pending: boolean;
  persona: Persona;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
}

export function Composer({
  draft,
  onDraftChange,
  onSubmit,
  onStop,
  pending,
  persona,
  textareaRef,
}: ComposerProps) {
  useEffect(() => {
    const area = textareaRef.current;
    if (!area) return;
    area.style.height = "auto";
    area.style.height = `${Math.min(area.scrollHeight, 168)}px`;
  }, [draft, textareaRef]);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (!pending && draft.trim() !== "") onSubmit();
    }
  }

  return (
    <div className="composer-wrap">
      <div className="composer">
        <label htmlFor="question" className="sr-only">
          Ask a question about company policy
        </label>
        <textarea
          id="question"
          ref={textareaRef}
          className="composer-input"
          rows={1}
          value={draft}
          placeholder={`Ask about leave, expenses, security…`}
          onChange={(event) => onDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          spellCheck={false}
          autoComplete="off"
        />
        {pending ? (
          <button
            type="button"
            className="send-btn is-stop"
            onClick={onStop}
            aria-label="Stop answering"
            title="Stop answering"
          >
            <StopIcon size={15} />
          </button>
        ) : (
          <button
            type="button"
            className="send-btn"
            onClick={onSubmit}
            disabled={draft.trim() === ""}
            aria-label="Send question"
            title="Send question"
          >
            <ArrowUpIcon size={17} />
          </button>
        )}
      </div>

      <div className="composer-hint">
        <span>
          Workspace context: <strong>{persona.name}</strong>
          <span className="dot" aria-hidden="true" />
          {persona.role}
        </span>
        <span className="composer-keys">
          <kbd>Enter</kbd> to send <span aria-hidden="true">·</span>{" "}
          <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
        </span>
      </div>
    </div>
  );
}
