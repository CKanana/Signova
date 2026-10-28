import type { Theme } from "./useTheme";

export interface TopbarProps {
  title: string;
  subtitle?: string;
  routeSection?: string;
  statusPill?: string;
  onRefresh?: () => void;
  onMenu?: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}

const icon = {
  className: "app-topbar__action-icon",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
} as const;

export function Topbar({
  title, subtitle, routeSection, statusPill,
  onRefresh, onMenu, theme, onToggleTheme,
}: TopbarProps) {
  const dark = theme === "dark";
  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <h1 className="app-topbar__title">{title}</h1>
        {subtitle || routeSection ? (
          <div className="app-topbar__subtitle">{subtitle ?? routeSection}</div>
        ) : null}
      </div>

      <div className="app-topbar__right">
        {statusPill ? (
          <div className="app-topbar__status">
            <span className="app-topbar__status-dot" />
            {statusPill}
          </div>
        ) : null}

        {onRefresh ? (
          <button type="button" className="app-topbar__action" onClick={onRefresh} aria-label="Refresh view">
            <svg {...icon}><path d="M20 11a8 8 0 1 0-2 5M20 4v7h-7" /></svg>
          </button>
        ) : null}

        {/* Moon in light mode (switch to dark), sun in dark mode */}
        <button
          type="button"
          className="app-topbar__action"
          onClick={onToggleTheme}
          aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {dark ? (
            <svg {...icon}>
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M5 19l1.5-1.5M17.5 6.5L19 5" />
            </svg>
          ) : (
            <svg {...icon}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" /></svg>
          )}
        </button>

        <button
          type="button"
          className="app-topbar__action app-topbar__action--menu"
          onClick={onMenu}
          aria-label="Open navigation menu"
        >
          <svg {...icon}><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
    </header>
  );
}