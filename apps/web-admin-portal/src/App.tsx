import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { AdminAuthProvider, useAdminAuth } from "./context/AdminAuthContext";
import { Spinner } from "./components/ui";
import { ConfirmDialog } from "./components/ui";
import { Login } from "./pages/Login";
import { AdminSetup } from "./pages/AdminSetup";
import { Overview } from "./pages/Overview";
import { Staff } from "./pages/Staff";
import { Tellers } from "./pages/Tellers";
import { Sessions } from "./pages/Sessions";
import { Audit } from "./pages/Audit";
import { OrganizationSettings } from "./pages/OrganizationSettings";
import { AccountSettings } from "./pages/AccountSettings";
import { DashboardIcon, StaffIcon, TellerIcon, SessionIcon, AuditIcon, SettingsIcon, UserIcon, LogoutIcon } from "./components/ui";
import { AppShell, type NavSections, type SidebarFooterProps } from "../../../../shared/app-shell/src";

// ---- Shared shell navigation configuration (Admin) ----------------------

const ROUTE_TITLES: Record<string, { section: string; title: string }> = {
  "/admin/overview": { section: "Dashboard", title: "Executive Overview" },
  "/admin/staff": { section: "Management", title: "Staff Directory" },
  "/admin/tellers": { section: "Management", title: "Service Counters & Tellers" },
  "/admin/sessions": { section: "Records", title: "Communication Sessions" },
  "/admin/audit": { section: "Records", title: "Audit Records" },
  "/admin/settings": { section: "Settings", title: "Organisation Configuration" },
  "/admin/account": { section: "Settings", title: "Administrator Account" },
};

const adminNavSections: NavSections[] = [
  {
    label: "Dashboard",
    items: [
      { id: "/admin/overview", label: "Overview", icon: <DashboardIcon /> },
    ],
  },
  {
    label: "Management",
    items: [
      { id: "/admin/staff", label: "Staff", icon: <StaffIcon /> },
      { id: "/admin/tellers", label: "Tellers", icon: <TellerIcon /> },
    ],
  },
  {
    label: "Records",
    items: [
      { id: "/admin/sessions", label: "Sessions", icon: <SessionIcon /> },
      { id: "/admin/audit", label: "Audit Logs", icon: <AuditIcon /> },
    ],
  },
  {
    label: "Settings",
    items: [
      { id: "/admin/settings", label: "Organization", icon: <SettingsIcon /> },
      { id: "/admin/account", label: "My Account", icon: <UserIcon /> },
    ],
  },
];

/** Turn a display name into two-letter initials. */
function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

/**
 * Protected route shell — renders the shared AppShell if authenticated.
 */
function AdminProtectedRoute({ children }: { children: ReactNode }) {
  const { user, organization, isAuthenticated, isLoading } = useAdminAuth();
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
    <AppShell
      brandLabel="ADMIN PORTAL"
      organization={{ name: organization?.name ?? "", serviceName: organization?.serviceName }}
      user={{ name: user.name, role: user.role, initials: initials(user.name) }}
      navSections={adminNavSections}
      title={routeInfo.title}
      subtitle={routeInfo.section}
      statusPill="Counter System Online"
      footer={
        <SidebarFooterProps>
          <button
            type="button"
            className="admin-btn admin-btn--ghost admin-btn--icon admin-btn--sm"
            onClick={() => setShowLogoutConfirm(true)}
            title="Log out"
            aria-label="Log out"
          >
            <LogoutIcon className="w-4 h-4" />
          </button>
        </SidebarFooterProps>
      }
    >
      {children}
    </AppShell>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AdminAuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin-setup" element={<AdminSetup />} />
          <Route path="/" element={<Navigate to="/admin/overview" replace />} />
          <Route
            path="/admin"
            element={
              <AdminProtectedRoute>
                <Navigate to="/admin/overview" replace />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/overview"
            element={
              <AdminProtectedRoute>
                <Overview />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/staff"
            element={
              <AdminProtectedRoute>
                <Staff />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/tellers"
            element={
              <AdminProtectedRoute>
                <Tellers />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/sessions"
            element={
              <AdminProtectedRoute>
                <Sessions />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <AdminProtectedRoute>
                <Audit />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/settings"
            element={
              <AdminProtectedRoute>
                <OrganizationSettings />
              </AdminProtectedRoute>
            }
          />
          <Route
            path="/admin/account"
            element={
              <AdminProtectedRoute>
                <AccountSettings />
              </AdminProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/admin/overview" replace />} />
        </Routes>
      </AdminAuthProvider>
    </BrowserRouter>
  );
}
