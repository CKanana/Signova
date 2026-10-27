import { useState, type ReactNode } from "react";
import { NavLink } from "react-router-dom";
import type { NavItem } from "./types";

function initials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DashboardShell({
  user,
  organization,
  navItems,
  activeNavId,
  topbarTitle,
  topbarSubtitle,
  topbarRight,
  isSidebarCollapsed = false,
  onToggleSidebar,
  sidebarFooter,
  children,
}: {
  user?: { name?: string; role?: string; initials?: string } | null;
  organization?: { name?: string; serviceName?: string; sub?: string } | null;
  navItems: NavItem[];
  activeNavId?: string;
  topbarTitle: string;
  topbarSubtitle?: string;
  topbarRight?: ReactNode;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
  sidebarFooter?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className={`staff-shell${isSidebarCollapsed ? " staff-shell--collapsed" : ""}`}>
      <aside className={`staff-sidebar${isSidebarCollapsed ? " staff-sidebar--collapsed" : ""}`} aria-label="Navigation">
        <div className="staff-sidebar__brand">
          <span className="staff-sidebar__brand-mark">Signova</span>
          {onToggleSidebar ? (
            <button
              type="button"
              className="staff-sidebar__toggle"
              onClick={onToggleSidebar}
              aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              aria-expanded={!isSidebarCollapsed}
            >
              {isSidebarCollapsed ? "»" : "«"}
            </button>
          ) : null}
        </div>

        {organization ? (
          <div className="staff-sidebar__org">
            <div className="staff-sidebar__org-label">Organization</div>
            <div className="staff-sidebar__org-name">{organization.name}</div>
            <div className="staff-sidebar__org-sub">{organization.serviceName ?? organization.sub}</div>
          </div>
        ) : null}

        <nav className="staff-sidebar__nav" aria-label="Main">
          <div className="staff-sidebar__section-label">Navigation</div>
          {navItems.map((item) => {
            const isActive = activeNavId
              ? item.to
                ? activeNavId === item.to
                : activeNavId === item.id
              : false;
            const inner = (
              <>
                <span className="staff-navitem__icon">{item.icon}</span>
                <span className="staff-navitem__label">{item.label}</span>
              </>
            );

            if (item.to) {
              return (
                <NavLink
                  key={item.id}
                  to={item.to}
                  className={() => `staff-navitem${isActive ? " staff-navitem--active" : ""}`}
                  aria-current={isActive ? "page" : undefined}
                >
                  {inner}
                </NavLink>
              );
            }

            return (
              <button
                key={item.id}
                type="button"
                className={`staff-navitem${isActive ? " staff-navitem--active" : ""}`}
                onClick={item.onClick}
                aria-current={isActive ? "page" : undefined}
              >
                {inner}
              </button>
            );
          })}
        </nav>

        <div className="staff-sidebar__footer">
          {user ? (
            <div className="staff-identity">
              <span className="staff-avatar" aria-hidden="true">
                {user.initials ?? initials(user.name ?? "U")}
              </span>
              <div className="staff-identity__meta">
                <div className="staff-identity__name">{user.name}</div>
                <div className="staff-identity__role">{user.role ?? "User"}</div>
              </div>
            </div>
          ) : null}
          {sidebarFooter}
        </div>
      </aside>

      <div className="staff-main">
        <header className="staff-topbar">
          <div className="staff-topbar__titles">
            <h1 className="staff-topbar__title">{topbarTitle}</h1>
            {topbarSubtitle ? <div className="staff-topbar__subtitle">{topbarSubtitle}</div> : null}
          </div>
          <div className="staff-topbar__spacer" />
          {topbarRight}
        </header>

        <main className="staff-view">{children}</main>
      </div>
    </div>
  );
}
