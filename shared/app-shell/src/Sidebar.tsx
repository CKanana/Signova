// Shared collapsible sidebar.
//
// Both Admin and Hearing Staff pass configuration (brand, organisation,
// identity, nav sections with items + optional badge counts, footer slot).
// No markup — every page renders inside the shared AppShell.

import { useState, type ReactNode } from "react";
import { useNavigate, useLocation } from "react-router-dom";

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

/** Navigation sections: { label, items } */
export interface NavSections {
  label: string;
  items: NavItem[];
}

/** Configuration injected by the host app, never markup */
export interface SidebarProps {
  /** App name overlayed on the logo ("ADMIN PORTAL" / "STAFF DESK") */
  brandLabel: string;
  /** Organisation card (Admin only) */
  organisation?: Organisation;
  /** User card (Admin only) – name, role, initials */
  user?: User;
  /** Navigation sections with items */
  navSections: NavSections[];
  /** Sidebar footer slots (required for Staff teller availability) */
  footer?: SidebarFooterProps;
  /** Collapsed state */
  collapsed: boolean;
  /** Toggle collapse/expand */
  onToggleCollapse: () => void;
  /** Open the off-canvas drawer (below 760px) */
  onOpenDrawer: () => void;
  /** Drawer open state */
  isDrawerOpen: boolean;
  /** Close the drawer */
  onCloseDrawer: () => void;
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
}: SidebarProps) {
  const navigate = useNavigate();
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
                  onClick={() => navigate(item.id)}
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
