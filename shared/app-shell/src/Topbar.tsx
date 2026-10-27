// Shared top bar: page title + breadcrumb/subtitle, optional status pill,
// refresh, theme toggle, user avatar, and (below 760px) a drawer menu
// button.
//
// Every style is scoped under .app-shell so the host app's global styles
// (the * reset, :focus-visible !important, --admin-* variables) cannot
// leak into this shell.

import { type ReactNode } from "react";
import type { Theme } from "./useTheme";

/** Status pill text, e.g. "Counter System Online" */
export interface TopbarProps {
  title: string;
  subtitle?: string;
  routeSection?: string;
  statusPill?: string;
  /** Optional refresh handler */
  onRefresh?: () => void;
  /** Optional menu/drawer button (shown below 760px) */
  onMenu?: () => void;
  /** Theme */
  theme: Theme;
  /** Theme toggle handler */
  onToggleTheme: () => void;
}

/** Theme values: light | dark */
export type Theme = "light" | "dark";

/**
 * Top bar: page title + breadcrumb/subtitle, status pill, refresh, theme
 * toggle, user avatar, and (below 760px) a drawer menu button.
 */
export function Topbar({
  title,
  subtitle,
  routeSection,
  statusPill,
  onRefresh,
  onMenu,
  theme,
  onToggleTheme,
}: TopbarProps) {
  return (
    <header className="app-topbar">
      <div className="app-topbar__left">
        <h1 className="app-topbar__title">{title}</h1>
        {subtitle ? (
          <div className="app-topbar__subtitle">{subtitle}</div>
        ) : routeSection ? (
          <div className="app-topbar__subtitle">{routeSection}</div>
        ) : null}
      </div>

      <div className="app-topbar__right">
        {statusPill ? (
          <div className="app-topbar__status">
            <span className="app-topbar__status-dot" />
            {statusPill}
          </div>
        ) : null}

        <button
          type="button"
          className="app-topbar__action"
          onClick={onRefresh}
          aria-label="Refresh view"
        >
          <svg className="app-topbar__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-9-9" />
            <polyline points="12 9 12 12 15 15" />
          </svg>
        </button>

        <button
          type="button"
          className="app-topbar__action"
          onClick={onToggleTheme}
          aria-label={
            theme === "light" ? "Switch to dark mode" : "Switch to light mode"
          }
        >
          {theme === "light" ? (
            <svg className="app-topbar__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="12" cy="12" r="5" />
              <line x1="12" y1="1" x2="12" y2="3" />
              <line x1="12" y1="21" x2="12" y2="23" />
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
              <line x1="1" y1="12" x2="3" y2="12" />
              <line x1="21" y1="12" x2="23" y2="12" />
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
            </svg>
          ) : (
            <svg className="app-topbar__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>

        {onMenu ? (
          <button
            type="button"
            className="app-topbar__action app-topbar__action--menu"
            onClick={onMenu}
            aria-label="Open navigation menu"
          >
            <svg className="app-topbar__action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        ) : null}
      </div>
    </header>
  );
}
