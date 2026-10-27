// Shared app shell: collapsible sidebar + top bar with light/dark theme.
//
// Reused by both the Admin portal and the Hearing Staff dashboard.
// Both apps pass configuration (nav sections/items, brand, identity)
// — never raw markup. All shell styles live in app-shell.css and are
// scoped under .app-shell so the host app's global styles (admin.css
// * reset, :focus-visible !important, --admin-* variables) cannot leak
// into this shell.

import { useEffect, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import type { Theme } from "./useTheme";

/** Navigation section: { label, items } */
export interface NavSection {
  label: string;
  items: NavItem[];
}

/** Navigation item: label, icon, route, optional badge count */
export interface NavItem {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

/** Organisation card info (optional) */
export interface Organisation {
  name: string;
  serviceName?: string;
}

/** User identity (optional) */
export interface User {
  name: string;
  role: string;
  initials: string;
}

/** Sidebar footer slot children (optional, e.g. Staff teller availability) */
export interface SidebarFooterProps {
  children?: ReactNode;
}

/** Configuration injected by the host app, never markup */
export interface AppShellProps {
  /** App name overlayed on the logo ("ADMIN PORTAL" / "STAFF DESK") */
  brandLabel: string;
  /** Organisation card (Admin only) — real org name/service, not placeholder */
  organization?: Organisation;
  /** User card (Admin only) – name, role, initials */
  user?: User;
  /** Sidebar footer slots (e.g. Staff teller availability control) */
  footer?: SidebarFooterProps;
  /** Navigation sections: { label, items } */
  navSections: NavSection[];
  /** Page title + optional subtitle/heading for the top bar */
  title: string;
  /** Breadcrumb/section label under the title */
  subtitle?: string;
  /** Route section (e.g. "Management", "Records") — shown under the title */
  routeSection?: string;
  /** Live status pill text (e.g. "Counter System Online") */
  statusPill?: string;
  /** Optional refresh handler */
  onRefresh?: () => void;
  /** Optional menu/drawer button handler (visible below 760px) */
  onMenu?: () => void;
  children: ReactNode;
}

/**
 * Collapsible sidebar.
 *
 * - Expands to 260px, collapses to 84px.
 * - Stores the preference in sessionStorage (try/catch).
 * - Under 980px: auto-collapses.
 * - Under 760px: off-canvas drawer opened by the top bar menu button
 *   (backdrop + Escape to close).
 * - Keyboard accessible: real buttons, focus ring, aria-current.
 */
export function Sidebar({
  brandLabel,
  organisation,
  user,
  navSections,
  footer,
  collapsed,
  onToggleCollapse,
  onOpenDrawer,
  isDrawerOpen,
  onCloseDrawer,
}: {
  brandLabel: string;
  organisation?: Organisation;
  user?: User;
  navSections: NavSection[];
  footer?: SidebarFooterProps;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenDrawer: () => void;
  isDrawerOpen: boolean;
  onCloseDrawer: () => void;
}) {
  const location = useLocation();

  return (
    <aside
      className={`app-sidebar${collapsed ? " app-sidebar--collapsed" : ""}${
        isDrawerOpen ? " app-sidebar--drawer-open" : ""
      }`}
      aria-label="Main navigation"
    >
      {/* Brand lockup */}
      <div className="app-sidebar__header">
        <div className="app-sidebar__logo">
          <span className="app-sidebar__logo-mark">S</span>
          <span className="app-sidebar__logo-text">
            <span className="app-sidebar__logo-name">Signova</span>
            {!collapsed && <span className="app-sidebar__logo-sub">{brandLabel}</span>}
          </span>
        </div>
        <button
          type="button"
          className="app-sidebar__toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? (
            <svg className="app-sidebar__toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <polyline points="9 18 15 12 9 6" />
            </svg>
          ) : (
            <svg className="app-sidebar__toggle-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          )}
        </button>
      </div>

      {!collapsed && organisation ? (
        <div className="app-sidebar__org">
          <div className="app-sidebar__org-label">Organization</div>
          <div className="app-sidebar__org-card">
            <div className="app-sidebar__org-name">{organisation.name}</div>
            {organisation.serviceName ? (
              <div className="app-sidebar__org-sub">{organisation.serviceName}</div>
            ) : null}
          </div>
        </div>
      ) : null}

      <nav className="app-sidebar__nav" aria-label="Main">
        {navSections.map((section) => (
          <div key={section.label} className="app-sidebar__nav-section">
            <div className="app-sidebar__nav-section-label">{section.label}</div>
            {section.items.map((item) => {
              const active = !collapsed && location.pathname === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  className={`app-sidebar__nav-item${
                    active ? " app-sidebar__nav-item--active" : ""
                  }`}
                  onClick={() => (window.location.href = item.id)}
                  aria-current={active ? "page" : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="app-sidebar__nav-item__icon">{item.icon}</span>
                  <span className="app-sidebar__nav-item__label">{item.label}</span>
                  {item.badge ? (
                    <span className="app-sidebar__nav-item__badge">{item.badge}</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        {!collapsed && user ? (
          <div className="app-sidebar__user">
            <span className="app-sidebar__user-avatar">{user.initials}</span>
            <div className="app-sidebar__user-meta">
              <span className="app-sidebar__user-name">{user.name}</span>
              <span className="app-sidebar__user-role">{user.role}</span>
            </div>
          </div>
        ) : null}
        {footer?.children ?? null}
      </div>

      {/* Off-canvas backdrop */}
      {isDrawerOpen ? (
        <div
          className="app-sidebar__backdrop"
          onClick={onCloseDrawer}
          aria-hidden="true"
        />
      ) : null}
    </aside>
  );
}

/**
 * Top bar: page title + breadcrumb/subtitle, optional status pill,
 * refresh, theme toggle, and (below 760px) a drawer menu button.
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
}: {
  title: string;
  subtitle?: string;
  routeSection?: string;
  statusPill?: string;
  onRefresh?: () => void;
  onMenu?: () => void;
  theme: Theme;
  onToggleTheme: () => void;
}) {
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

/**
 * Shared app shell: collapsible sidebar + top bar + main content area.
 *
 * Both Admin and Hearing Staff pass configuration (nav sections, brand,
 * identity, organisation card, status pill, footer slot) instead of markup.
 */
export function AppShell({
  brandLabel,
  organization,
  user,
  footer,
  navSections,
  title,
  subtitle,
  routeSection,
  statusPill,
  onRefresh,
  onMenu,
  children,
}: AppShellProps) {
  const [theme, setTheme] = useState<Theme>("light");
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Theme: system preference, then saved choice; persisted on change.
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const stored = localStorage.getItem("signova-theme");
    const resolved = stored === "light" || stored === "dark"
      ? stored
      : media.matches
        ? "dark"
        : "light";
    setTheme(resolved);

    const handler = (e: MediaQueryListEvent) => {
      if (!localStorage.getItem("signova-theme")) {
        setTheme(e.matches ? "dark" : "light");
      }
    };
    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    localStorage.setItem("signova-theme", theme);
  }, [theme]);

  // Collapse the sidebar automatically below 980px (until the user picks a preference).
  useEffect(() => {
    const handler = () => {
      setSidebarCollapsed((prev) => (window.innerWidth < 980 ? true : prev));
    };
    window.addEventListener("resize", handler);
    handler();
    return () => window.removeEventListener("resize", handler);
  }, []);

  // Escape + backdrop to close the drawer; menu button only visible < 760px.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const toggleTheme = () => setTheme((t) => (t === "light" ? "dark" : "light"));
  const toggleSidebar = () => {
    const next = !sidebarCollapsed;
    try {
      sessionStorage.setItem("signova.app.sidebar.collapsed", next ? "1" : "0");
    } catch {
      // sessionStorage unavailable
    }
    setSidebarCollapsed(next);
  };

  return (
    <div className="app-shell">
      <Sidebar
        brandLabel={brandLabel}
        organisation={organization}
        user={user}
        navSections={navSections}
        footer={footer}
        collapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebar}
        onOpenDrawer={() => setDrawerOpen(true)}
        isDrawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />
      <div className="app-main">
        <Topbar
          title={title}
          subtitle={subtitle}
          routeSection={routeSection}
          statusPill={statusPill}
          onRefresh={onRefresh}
          onMenu={
            window.innerWidth < 760 ? () => setDrawerOpen(true) : undefined
          }
          theme={theme}
          onToggleTheme={toggleTheme}
        />
        <main className="app-main__content">{children}</main>
      </div>
    </div>
  );
}
