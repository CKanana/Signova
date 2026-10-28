import type { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";

export interface NavItem {
  id: string; // route path, e.g. "/admin/staff"
  label: string;
  icon: ReactNode;
  badge?: number;
}
export interface NavSection {
  label: string;
  items: NavItem[];
}
export interface Organisation {
  name: string;
  serviceName?: string;
}
export interface User {
  name: string;
  role: string;
  initials: string;
}
export type SidebarFooterProps = ReactNode;

export interface SidebarProps {
  brandLabel: string;
  /** Real Signova mark; shown white on the purple sidebar. Falls back to "S". */
  logoSrc?: string;
  organisation?: Organisation;
  user?: User;
  onSignOut?: () => void;
  navSections: NavSection[];
  footer?: SidebarFooterProps;
  collapsed: boolean;
  isDrawerOpen: boolean;
  onToggleCollapse: () => void;
}

export function Sidebar({
  brandLabel, logoSrc, organisation, user, onSignOut,
  navSections, footer, collapsed, isDrawerOpen, onToggleCollapse,
}: SidebarProps) {
  const { pathname } = useLocation();

  return (
    <aside
      className={`app-sidebar${collapsed ? " app-sidebar--collapsed" : ""}${
        isDrawerOpen ? " app-sidebar--drawer-open" : ""
      }`}
      aria-label="Main navigation"
    >
      <div className="app-sidebar__header">
        <div className="app-sidebar__logo">
          {logoSrc ? (
            <img className="app-sidebar__logo-img" src={logoSrc} alt="Signova" />
          ) : (
            <span className="app-sidebar__logo-mark">S</span>
          )}
          <span className="app-sidebar__logo-text">
            <span className="app-sidebar__logo-name">Signova</span>
            <span className="app-sidebar__logo-sub">{brandLabel}</span>
          </span>
        </div>
        <button
          type="button"
          className="app-sidebar__toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          <svg className="app-sidebar__toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
            <path d={collapsed ? "M9 6l6 6-6 6" : "M15 6l-6 6 6 6"} />
          </svg>
        </button>
      </div>

      {organisation ? (
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
              const active = pathname === item.id || pathname.startsWith(item.id + "/");
              return (
                <Link
                  key={item.id}
                  to={item.id}
                  className={`app-sidebar__nav-item${active ? " app-sidebar__nav-item--active" : ""}`}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? item.label : undefined}
                  title={collapsed ? item.label : undefined}
                >
                  <span className="app-sidebar__nav-item__icon">{item.icon}</span>
                  <span className="app-sidebar__nav-item__label">{item.label}</span>
                  {item.badge ? (
                    <span className="app-sidebar__nav-item__badge">{item.badge}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="app-sidebar__footer">
        {footer ?? null}
        {user ? (
          <div className="app-sidebar__user">
            <span className="app-sidebar__user-avatar">{user.initials}</span>
            <div className="app-sidebar__user-meta">
              <span className="app-sidebar__user-name">{user.name}</span>
              <span className="app-sidebar__user-role">{user.role}</span>
            </div>
            {onSignOut ? (
              <button
                type="button"
                className="app-sidebar__signout"
                onClick={onSignOut}
                aria-label="Sign out"
                title="Sign out"
              >
                <svg className="app-sidebar__toggle-icon" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M9 4H5v16h4M16 8l4 4-4 4M20 12H9" />
                </svg>
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </aside>
  );
}