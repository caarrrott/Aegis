import type { Persona } from "../lib/personas";
import { ArrowRightIcon, ShieldMark } from "./Icons";

interface EmptyStateProps {
  persona: Persona;
  onPick: (question: string) => void;
}

export function EmptyState({ persona, onPick }: EmptyStateProps) {
  return (
    <div className="empty">
      <div className="crest" aria-hidden="true">
        <ShieldMark size={26} />
      </div>
      <p className="eyebrow">Aegis policy assistant</p>
      <h2 className="empty-title">
        How can I <em>help</em> today?
      </h2>
      <p className="empty-lede">
        Ask a question about your company policies. Aegis answers from the
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

    </div>
  );
}
