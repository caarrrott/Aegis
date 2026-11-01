export type Theme = "light" | "dark";

const STORAGE_KEY = "aegis-theme";

/** Resolve the theme the document should start in. */
export function initialTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    /* storage unavailable — fall through to system preference */
  }
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

/** Reflect the theme onto <html> (and the browser chrome color). */
export function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta instanceof HTMLMetaElement) {
    meta.content = theme === "dark" ? "#15181a" : "#f7f5f0";
  }
}

/** Remember an explicit user choice; if they never chose, keep following the OS. */
export function persistTheme(theme: Theme) {
  try {
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    /* ignore */
  }
}
