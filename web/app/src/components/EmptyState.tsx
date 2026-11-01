import type { Persona } from "../lib/personas";
import { ArrowRightIcon, ShieldMark } from "./Icons";

interface EmptyStateProps {
  persona: Persona;
  onPick: (question: string) => void;
  onOpenLibrary: () => void;
}

export function EmptyState({ persona, onPick, onOpenLibrary }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="crest" aria-hidden="true">
        <ShieldMark size={26} />
      </div>
      <p className="eyebrow">Confidential by design</p>
      <h2 className="empty-title">
        Ask the <em>policies.</em>
      </h2>
      <p className="empty-lede">
        Every answer quotes the exact sentence it came from — drawn only from
        documents {persona.name} is allowed to read.
      </p>

      <div className="suggestions" aria-label="Suggested questions">
        {persona.suggestions.map((question, index) => (
          <button
            type="button"
            key={question}
            className="suggestion"
            onClick={() => onPick(question)}
          >
            <span className="suggestion-index">
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className="suggestion-text">{question}</span>
            <ArrowRightIcon size={15} className="suggestion-arrow" />
          </button>
        ))}
      </div>

      <p className="empty-foot">
        Signed in as <strong>{persona.name}</strong>
        <span className="dot" aria-hidden="true" />
        {persona.role}
        <span className="dot" aria-hidden="true" />
        <button type="button" className="text-btn" onClick={onOpenLibrary}>
          Browse the library
        </button>
      </p>
    </div>
  );
}
