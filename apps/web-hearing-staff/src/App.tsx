import React, { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from "react-router-dom";
import { StaffAuthProvider, useStaffAuth } from "./context/AuthContext";
import { StaffWorkspaceProvider, useStaffWorkspace } from "./context/StaffWorkspaceContext";
import { LoginScreen } from "./pages/LoginPage";
import { StaffSetup } from "./pages/StaffSetup";
import { DashboardPage } from "./pages/DashboardPage";
import { SessionPage } from "./pages/SessionPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoadingState } from "./components/ui/States";
import { Button } from "./components/ui/Button";
import { Badge, tellerBadge } from "./components/ui/Badge";
import { IconDashboard, IconMessage, IconHistory, IconSettings } from "./components/ui/Icons";
import { disconnectStaffSocket } from "./services/socket";
import { AppShell, type NavSection } from "../../../shared/app-shell/src";
import signovaLogoLight from "../../../shared/brand-assets/signova-logo-horizontal-light.png";
import signovaMarkLight from "../../../shared/brand-assets/signova-mark-light.png";

const ROUTE_TITLES: Record<string, { section: string; title: string }> = {
  "/staff/dashboard": { section: "Workspace", title: "Dashboard" },
  "/staff/session": { section: "Workspace", title: "Active session" },
  "/staff/history": { section: "Workspace", title: "Session history" },
  "/staff/settings": { section: "Workspace", title: "Account" },
};

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function connectionStatusPill(state: string) {
  switch (state) {
    case "connected":
      return "Live";
    case "connecting":
      return "Connecting…";
    case "reconnecting":
      return "Reconnecting…";
    case "disconnected":
      return "Disconnected";
    default:
      return "Offline";
  }
}

function TellerAvailabilityFooter() {
  const { assignedTellers, isSavingAvailability, setAvailability } = useStaffWorkspace();
  const teller = assignedTellers[0];
  if (!teller) return null;

  return (
    <div className="staff-teller-state">
      <div className="staff-teller-state__row">
        <div>
          <div className="staff-teller-state__name">Counter {teller.counterNumber}</div>
          <div className="staff-teller-state__sub">{teller.serviceDesk}</div>
        </div>
        <Badge tone={tellerBadge(teller.status).tone} dot>
          {tellerBadge(teller.status).label}
        </Badge>
      </div>
      {teller.status !== "BUSY" ? (
        <div className="staff-teller-state__actions">
          <Button
            size="sm"
            variant={teller.status === "FREE" ? "primary" : "secondary"}
            loading={isSavingAvailability}
            onClick={() => void setAvailability(teller._id, "FREE")}
            disabled={teller.status === "FREE"}
          >
            Available
          </Button>
          <Button
            size="sm"
            variant={teller.status === "OFFLINE" ? "primary" : "secondary"}
            loading={isSavingAvailability}
            onClick={() => void setAvailability(teller._id, "OFFLINE")}
            disabled={teller.status === "OFFLINE"}
          >
            Offline
          </Button>
        </div>
      ) : (
        <p className="staff-teller-state__sub" style={{ marginTop: 8 }}>
          Availability is managed automatically while you are in a session.
        </p>
      )}
    </div>
  );
}

function StaffProtectedShell() {
  const { organization, user } = useStaffWorkspace();
  const { signOut } = useStaffAuth();
  const { pendingRequest, connection, activeSessionId } = useStaffWorkspace();
  const location = useLocation();
  const navigate = useNavigate();

  const routeInfo = ROUTE_TITLES[location.pathname] ?? { section: "Workspace", title: "Dashboard" };

  const navSections: NavSection[] = [
    {
      label: "Workspace",
      items: [
        { id: "/staff/dashboard", label: "Dashboard", icon: <IconDashboard /> },
        {
          id: "/staff/session",
          label: "Active session",
          icon: <IconMessage />,
          badge: pendingRequest ? 1 : undefined,
        },
        { id: "/staff/history", label: "Session history", icon: <IconHistory /> },
        { id: "/staff/settings", label: "Account", icon: <IconSettings /> },
      ],
    },
  ];

  return (
    <AppShell
      brandLabel="TELLER DESK"
      logoSrc={signovaLogoLight}
      logoMarkSrc={signovaMarkLight}
      organization={{ name: organization?.name ?? "", serviceName: organization?.serviceName }}
      user={user ? { name: user.name, role: "Teller", initials: initials(user.name) } : undefined}
      onSignOut={() => void signOut()}
      navSections={navSections}
      title={routeInfo.title}
      subtitle={routeInfo.section}
      statusPill={connectionStatusPill(connection)}
      footer={<TellerAvailabilityFooter />}
    >
      <Routes>
        <Route path="/" element={<Navigate to="/staff/dashboard" replace />} />
        <Route path="/staff" element={<Navigate to="/staff/dashboard" replace />} />
        <Route
          path="/staff/dashboard"
          element={
            <DashboardPage
              onOpenSession={() => navigate("/staff/session")}
              onOpenHistory={() => navigate("/staff/history")}
            />
          }
        />
        <Route
          path="/staff/session"
          element={
            <SessionPage
              onNavigate={(v) => navigate(v === "dashboard" ? "/staff/dashboard" : "/staff/history")}
            />
          }
        />
        <Route path="/staff/history" element={<HistoryPage />} />
        <Route path="/staff/settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/staff/dashboard" replace />} />
      </Routes>
      <span className="sr-only" aria-live="polite">
        {activeSessionId ? "A communication session is active." : "No active session."}
      </span>
    </AppShell>
  );
}

export default function App() {
  return (
    <StaffAuthProvider>
      <StaffWorkspaceProvider>
        <Root />
      </StaffWorkspaceProvider>
    </StaffAuthProvider>
  );
}

function Root() {
  const { isAuthenticated, isLoading } = useStaffAuth();
  const [setupToken, setSetupToken] = useState<string | null>(null);

  React.useEffect(() => {
    if (isAuthenticated) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (token) {
      setSetupToken(token);
    } else if (window.location.pathname === "/invite") {
      setSetupToken("");
    }
  }, [isAuthenticated]);

  React.useEffect(() => {
    if (!isAuthenticated) {
      disconnectStaffSocket();
    }
  }, [isAuthenticated]);

  if (isLoading) {
    return (
      <main className="staff-login__panel" style={{ minHeight: "100vh" }}>
        <LoadingState label="Checking your session…" />
      </main>
    );
  }

  if (!isAuthenticated && setupToken !== null) {
    return <StaffSetup token={setupToken} onCancel={() => setSetupToken(null)} />;
  }

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return (
    <BrowserRouter>
      <StaffProtectedShell />
    </BrowserRouter>
  );
}
