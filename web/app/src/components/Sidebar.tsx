import { PERSONAS, type Persona, VISIBILITY_ORDER } from "../lib/personas";
import { ArrowRightIcon, CloseIcon, DocIcon, ShieldMark } from "./Icons";

interface SidebarProps {
  activeId: string;
  onSelect: (id: string) => void;
  online: boolean | null;
  documentCount: number | null;
  onOpenLibrary: () => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  activeId,
  onSelect,
  online,
  documentCount,
  onOpenLibrary,
  open,
  onClose,
}: SidebarProps) {
  return (
    <aside className={`sidebar${open ? " is-open" : ""}`} aria-label="Workspace">
      <div className="sidebar-scroll">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ShieldMark size={22} />
          </span>
          <span className="brand-text">
            <span className="brand-name">Aegis</span>
            <span className="brand-sub">Policy intelligence</span>
          </span>
          <button
            type="button"
            className="icon-btn sidebar-close only-mobile"
            onClick={onClose}
            aria-label="Close menu"
          >
            <CloseIcon />
          </button>
        </div>

        <section className="side-section">
          <p className="label">Answering as</p>
          <div className="persona-list" role="group" aria-label="Demo users">
            {PERSONAS.map((persona) => (
              <PersonaOption
                key={persona.id}
                persona={persona}
                selected={persona.id === activeId}
                onSelect={onSelect}
              />
            ))}
          </div>
        </section>

      </div>

      <div className="sidebar-foot">
        <button type="button" className="library-link" onClick={onOpenLibrary}>
          <span className="library-glyph" aria-hidden="true">
            <DocIcon size={16} />
          </span>
          <span className="library-copy">
            <span className="library-title">Policy library</span>
            <span className="library-sub">
              {documentCount === null
                ? "Loading documents"
                : `${documentCount} document${documentCount === 1 ? "" : "s"} indexed`}
            </span>
          </span>
          <ArrowRightIcon size={15} className="library-arrow" />
        </button>

        <div className="status-line" role="status">
          <span
            className={`status-dot${
              online === null ? " is-idle" : online ? "" : " is-offline"
            }`}
            aria-hidden="true"
          />
          <span>
            {online === null
              ? "Checking connection"
              : online
                ? "Connected to Aegis"
                : "Server offline"}
          </span>
        </div>
      </div>
    </aside>
  );
}

function PersonaOption({
  persona,
  selected,
  onSelect,
}: {
  persona: Persona;
  selected: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      className={`persona${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(persona.id)}
    >
      <span
        className={`monogram${persona.id === "guest" ? " is-guest" : ""}`}
        aria-hidden="true"
      >
        {persona.initials}
      </span>
      <span className="persona-text">
        <span className="persona-name">{persona.name}</span>
        <span className="persona-role">{persona.location}</span>
      </span>
      <span
        className="meter"
        aria-label={`Can read ${persona.access.join(", ")} documents`}
      >
        {VISIBILITY_ORDER.map((level) => (
          <i
            key={level}
            className={persona.access.includes(level) ? "is-on" : undefined}
          />
        ))}
      </span>
    </button>
  );
}
