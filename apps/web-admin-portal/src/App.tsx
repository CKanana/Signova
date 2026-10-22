import { useState, useEffect, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, NavLink, useLocation } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import {
  Spinner,
  DashboardIcon,
  StaffIcon,
  TellerIcon,
  SessionIcon,
  AuditIcon,
  SettingsIcon,
  UserIcon,
  LogoutIcon,
  RefreshIcon,
  ConfirmDialog,
} from "./components/ui";
import { Login } from "./pages/Login";
import { AdminSetup } from "./pages/AdminSetup";
import { Overview } from "./pages/Overview";
import { Staff } from "./pages/Staff";
import { Tellers } from "./pages/Tellers";
import { Sessions } from "./pages/Sessions";
import { Audit } from "./pages/Audit";
import { OrganizationSettings } from "./pages/OrganizationSettings";
import { AccountSettings } from "./pages/AccountSettings";

const ROUTE_TITLES: Record<string, { section: string; title: string }> = {
  "/admin/overview": { section: "Dashboard", title: "Executive Overview" },
  "/admin/staff": { section: "Management", title: "Staff Directory" },
  "/admin/tellers": { section: "Management", title: "Service Counters & Tellers" },
  "/admin/sessions": { section: "Records", title: "Communication Sessions" },
  "/admin/audit": { section: "Records", title: "Audit Records" },
  "/admin/settings": { section: "Settings", title: "Organisation Configuration" },
  "/admin/account": { section: "Settings", title: "Administrator Account" },
};

/** Protected route shell. Redirects to login unless authenticated. */
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, isLoading, signOut } = useAdminAuth();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="admin-auth-canvas">
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
          <Spinner className="w-8 h-8" color="var(--admin-primary)" />
          <p style={{ fontSize: "13px", color: "var(--admin-text-secondary)" }}>Verifying session…</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />;
  }

  const routeInfo = ROUTE_TITLES[location.pathname] ?? { section: "Admin", title: "Overview" };

  return (
    <div className="admin-shell">
      {/* Sidebar */}
      <aside className="admin-sidebar" aria-label="Main Navigation">
        <div className="admin-sidebar__header">
          <div className="admin-brand">
            <div className="admin-brand__badge">S</div>
            <div className="admin-brand__text">
              <span className="admin-brand__name">Signova</span>
              <span className="admin-brand__tag">Admin Portal</span>
            </div>
          </div>
          <div className="admin-sidebar__org-card">
            <span className="admin-sidebar__org-dot" />
            <div className="admin-sidebar__org-details">
              <p className="admin-sidebar__org-title">Kenyatta National Hospital</p>
              <p className="admin-sidebar__org-sub">Institutional Admin</p>
            </div>
          </div>
        </div>

        <nav className="admin-sidebar__nav">
          {/* Section: Overview */}
          <div className="admin-nav-group">
            <span className="admin-nav-group__label">Overview</span>
            <NavLink
              to="/admin/overview"
              className={({ isActive }) => `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`}
            >
              <span className="admin-nav-item__icon">
                <DashboardIcon />
              </span>
              <span>Overview</span>
            </NavLink>
          </div>

          {/* Section: Management */}
          <div className="admin-nav-group">
            <span className="admin-nav-group__label">Management</span>
            <NavLink
              to="/admin/staff"
              className={({ isActive }) => `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`}
            >
              <span className="admin-nav-item__icon">
                <StaffIcon />
              </span>
              <span>Staff</span>
            </NavLink>
            <NavLink
              to="/admin/tellers"
              className={({ isActive }) => `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`}
            >
              <span className="admin-nav-item__icon">
                <TellerIcon />
              </span>
              <span>Tellers</span>
            </NavLink>
          </div>

          {/* Section: Records */}
          <div className="admin-nav-group">
            <span className="admin-nav-group__label">Records</span>
            <NavLink
              to="/admin/sessions"
              className={({ isActive }) => `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`}
            >
              <span className="admin-nav-item__icon">
                <SessionIcon />
              </span>
              <span>Sessions</span>
            </NavLink>
            <NavLink
              to="/admin/audit"
              className={({ isActive }) => `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`}
            >
              <span className="admin-nav-item__icon">
                <AuditIcon />
              </span>
              <span>Audit Logs</span>
            </NavLink>
          </div>

          {/* Section: Settings */}
          <div className="admin-nav-group">
            <span className="admin-nav-group__label">Settings</span>
            <NavLink
              to="/admin/settings"
              className={({ isActive }) => `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`}
            >
              <span className="admin-nav-item__icon">
                <SettingsIcon />
              </span>
              <span>Organization</span>
            </NavLink>
            <NavLink
              to="/admin/account"
              className={({ isActive }) => `admin-nav-item ${isActive ? "admin-nav-item--active" : ""}`}
            >
              <span className="admin-nav-item__icon">
                <UserIcon />
              </span>
              <span>My Account</span>
            </NavLink>
          </div>
        </nav>

        {/* Sidebar Footer */}
        <div className="admin-sidebar__footer">
          <div className="admin-user-pill">
            <div className="admin-user-avatar">{user.name?.charAt(0) ?? "A"}</div>
            <div className="admin-user-info">
              <span className="admin-user-name" title={user.name}>
                {user.name}
              </span>
              <span className="admin-user-role">Administrator</span>
            </div>
          </div>
          <button
            className="admin-btn admin-btn--ghost admin-btn--icon"
            onClick={() => setShowLogoutConfirm(true)}
            title="Log out"
            aria-label="Log out"
          >
            <LogoutIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Surface */}
      <div className="admin-main">
        {/* Topbar */}
        <header className="admin-topbar">
          <div className="admin-topbar__breadcrumbs">
            <span>{routeInfo.section}</span>
            <span>/</span>
            <span className="admin-topbar__crumb-active">{routeInfo.title}</span>
          </div>

          <div className="admin-topbar__actions">
            <div className="admin-system-indicator" title="Service counter communication online">
              <span className="admin-system-indicator__dot" />
              <span>Counter System Online</span>
            </div>
            <button
              className="admin-btn admin-btn--ghost admin-btn--icon"
              onClick={() => window.location.reload()}
              title="Refresh view"
              aria-label="Refresh view"
            >
              <RefreshIcon className="w-4 h-4" />
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main>{children}</main>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        onClose={() => setShowLogoutConfirm(false)}
        onConfirm={() => {
          setShowLogoutConfirm(false);
          void signOut();
        }}
        title="Sign Out"
        message="Are you sure you want to end your administration session?"
        confirmText="Sign Out"
        confirmVariant="danger"
      />
    </div>
  );
}

export default function App() {
  return (
    <AdminAuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin-setup" element={<AdminSetup />} />
          <Route path="/" element={<Navigate to="/admin/overview" replace />} />
          <Route
            path="/admin"
            element={
              <ProtectedRoute>
                <Navigate to="/admin/overview" replace />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/overview"
            element={
              <ProtectedRoute>
                <Overview />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <ProtectedRoute>
                <Staff />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tellers"
            element={
              <ProtectedRoute>
                <Tellers />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/sessions"
            element={
              <ProtectedRoute>
                <Sessions />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute>
                <Audit />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <ProtectedRoute>
                <OrganizationSettings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/account"
            element={
              <ProtectedRoute>
                <AccountSettings />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/admin/overview" replace />} />
        </Routes>
      </BrowserRouter>
    </AdminAuthProvider>
  );
}
