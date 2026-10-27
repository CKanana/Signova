import { useLocation, useNavigate } from "react-router-dom";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { DashboardIcon, StaffIcon, TellerIcon, SessionIcon, AuditIcon, SettingsIcon, UserIcon, LogoutIcon } from "../../components/ui";
import { IconChevronLeftIcon, IconChevronRightIcon } from "../../components/ui/Icons";
import { useState } from "react";

/** Collapsible admin sidebar. Mirrors the hearing-staff portal's persistent
 *  sidebar (collapsible, tooltips when collapsed, active-route indication)
 *  while reusing the admin design system tokens. */
export function AdminSidebar() {
  const { user, organization, signOut } = useAdminAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [showLogout, setShowLogout] = useState(false);

  const navItems = [
    { id: "/admin/overview", label: "Overview", icon: <DashboardIcon /> },
    { id: "/admin/staff", label: "Staff", icon: <StaffIcon /> },
    { id: "/admin/tellers", label: "Tellers", icon: <TellerIcon /> },
    { id: "/admin/sessions", label: "Sessions", icon: <SessionIcon /> },
    { id: "/admin/audit", label: "Audit Logs", icon: <AuditIcon /> },
    { id: "/admin/settings", label: "Organization", icon: <SettingsIcon /> },
    { id: "/admin/account", label: "My Account", icon: <UserIcon /> },
  ];

  const [collapsed, setCollapsed] = useState<boolean>(() => {
    // Persist collapse preference in sessionStorage; fall back to system
    // reduced-motion (expanded) when the user has asked for reduced motion.
    try {
      const saved = window.sessionStorage.getItem("signova.admin.sidebar.collapsed");
      if (saved !== null) return saved === "1";
      if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return true;
    } catch {
      // sessionStorage unavailable
    }
    return false;
  });

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      try {
        window.sessionStorage.setItem("signova.admin.sidebar.collapsed", next ? "1" : "0");
      } catch {
        // sessionStorage unavailable
      }
      return next;
    });
  };

  const initials = (name: string) =>
    name
      .split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase();

  return (
    <aside
      className={`admin-sidebar${collapsed ? " admin-sidebar--collapsed" : ""}`}
      aria-label="Main Navigation"
    >
      <div className="admin-sidebar__header">
        <div className="admin-brand">
          <div className="admin-brand__badge">S</div>
          {!collapsed && (
            <div className="admin-brand__text">
              <span className="admin-brand__name">Signova</span>
              <span className="admin-brand__tag">Admin Portal</span>
            </div>
          )}
        </div>
        {!collapsed && organization && (
          <div className="admin-sidebar__org-card">
            <span className="admin-sidebar__org-dot" />
            <div className="admin-sidebar__org-details">
              <p className="admin-sidebar__org-title">{organization.name}</p>
              <p className="admin-sidebar__org-sub">
                {organization.serviceName ?? "Institutional Admin"}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="admin-sidebar__toggle-wrap">
        <button
          type="button"
          className="admin-sidebar__toggle"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <IconChevronRightIcon className="w-4 h-4" /> : <IconChevronLeftIcon className="w-4 h-4" />}
        </button>
      </div>

      <nav className="admin-sidebar__nav" aria-label="Main">
        {navItems.map((item) => {
          const active = location.pathname === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`admin-nav-item${active ? " admin-nav-item--active" : ""}`}
              onClick={() => navigate(item.id)}
              aria-current={active ? "page" : undefined}
              title={collapsed ? item.label : undefined}
            >
              <span className="admin-nav-item__icon">{item.icon}</span>
              {!collapsed && <span className="admin-nav-item__label">{item.label}</span>}
            </button>
          );
        })}
      </nav>

      <div className="admin-sidebar__footer">
        {!collapsed && user && organization && (
          <div className="admin-user-pill">
            <div className="admin-user-avatar">{initials(user.name)}</div>
            <div className="admin-user-info">
              <span className="admin-user-name" title={user.name}>
                {user.name}
              </span>
              <span className="admin-user-role">Administrator</span>
            </div>
          </div>
        )}
        <button
          type="button"
          className="admin-btn admin-btn--ghost admin-btn--icon admin-btn--sm"
          onClick={() => setShowLogout(true)}
          title="Log out"
          aria-label="Log out"
        >
          <LogoutIcon className="w-4 h-4" />
        </button>
        <button
          type="button"
          className="admin-sidebar__collapse-hint"
          onClick={toggleCollapsed}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? "Expand" : "Collapse"}
        </button>
      </div>

      {/* Logout confirmation (visible on hover/focus when collapsed) */}
      <div className="admin-sidebar__logout-overlay" onClick={() => setShowLogout(false)} />
      <button
        type="button"
        className="admin-sidebar__logout-btn"
        onClick={() => {
          setShowLogout(false);
          void signOut();
        }}
        style={{ display: showLogout ? "flex" : "none" }}
        aria-label="Confirm sign out"
      >
        <LogoutIcon className="w-4 h-4" />
        <span>Sign out</span>
      </button>
    </aside>
  );
}
