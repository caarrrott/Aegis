import { CloseIcon, DocIcon, ShieldMark } from "./Icons";

interface SidebarProps {
  online: boolean | null;
  documentCount: number | null;
  onOpenLibrary: () => void;
  open: boolean;
  onClose: () => void;
}

export function Sidebar({
  online,
  documentCount,
  onOpenLibrary,
  open,
  onClose,
}: SidebarProps) {
  return (
    <aside
      id="workspace-sidebar"
      className={`sidebar${open ? " is-open" : ""}`}
      aria-label="Workspace"
    >
      <div className="sidebar-scroll">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <ShieldMark size={22} />
          </span>
          <span className="brand-text">
            <span className="brand-name">Aegis</span>
            <span className="brand-sub">Workspace intelligence</span>
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

        <nav className="sidebar-nav" aria-label="Workspace navigation">
          <p className="sidebar-nav-label">Workspace</p>
          <button
            type="button"
            className="sidebar-nav-item is-active"
            onClick={onOpenLibrary}
          >
            <span className="sidebar-nav-icon" aria-hidden="true">
              <DocIcon size={16} />
            </span>
            <span className="sidebar-nav-copy">
              <span>Policy library</span>
              <small>
                {documentCount === null
                  ? "Loading documents"
                  : `${documentCount} indexed`}
              </small>
            </span>
          </button>
        </nav>
      </div>

      <div className="sidebar-foot">
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
