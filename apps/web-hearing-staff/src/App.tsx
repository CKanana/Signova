import React, { useCallback, useState } from "react";
import { StaffAuthProvider, useStaffAuth } from "./context/AuthContext";
import { StaffWorkspaceProvider, useStaffWorkspace } from "./context/StaffWorkspaceContext";
import { Sidebar, type StaffViewName } from "./components/layout/Sidebar";
import { Topbar } from "./components/layout/Topbar";
import { LoginScreen } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { SessionPage } from "./pages/SessionPage";
import { HistoryPage } from "./pages/HistoryPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LoadingState } from "./components/ui/States";
import { disconnectStaffSocket } from "./services/socket";

/**
 * Staff application shell.
 *
 * Route guarding happens in two layers:
 *  1. This component only renders the workspace when useStaffAuth() reports
 *     an authenticated STAFF/ADMIN session (a token the backend signed).
 *  2. Every API and socket call is re-authorized server-side — the client
 *     gate is convenience, not security. No staff data is ever fetched
 *     without a Bearer token.
 */

type View = StaffViewName;

const VIEW_TITLES: Record<View, { title: string; subtitle: string }> = {
  dashboard: { title: "Dashboard", subtitle: "Your communication desk" },
  session: { title: "Active session", subtitle: "Real-time conversation workspace" },
  history: { title: "Session history", subtitle: "Past conversations" },
  settings: { title: "Account", subtitle: "Profile and security" },
};

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

  // Tear the socket down whenever the session ends (sign-out / token drop).
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

  if (!isAuthenticated) {
    return <LoginScreen />;
  }

  return <Workspace />;
}

function Workspace() {
  const [view, setView] = useState<View>("dashboard");
  const { pendingRequest, activeSessionId, view: sessionView } = useStaffWorkspace();

  const navigate = useCallback((next: View) => setView(next), []);

  // Auto-navigate to the session workspace when a request arrives so the
  // staff member is pulled into the conversation immediately.
  const lastRequestRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (pendingRequest && pendingRequest.sessionId !== lastRequestRef.current) {
      lastRequestRef.current = pendingRequest.sessionId;
    }
  }, [pendingRequest]);

  const meta = VIEW_TITLES[view];
  const hasActiveSession = sessionView.kind === "active";

  // Keyboard shortcut: Escape returns to the dashboard from any view.
  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && view !== "dashboard") setView("dashboard");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  return (
    <div className="staff-shell">
      <Sidebar
        current={view}
        onNavigate={navigate}
        hasActiveSession={hasActiveSession}
        hasPendingRequest={!!pendingRequest}
      />
      <div className="staff-main">
        <Topbar title={meta.title} subtitle={meta.subtitle} />
        <main className="staff-view">
          {view === "dashboard" ? (
            <DashboardPage onOpenSession={() => navigate("session")} onOpenHistory={() => navigate("history")} />
          ) : null}
          {view === "session" ? <SessionPage onNavigate={navigate} /> : null}
          {view === "history" ? <HistoryPage /> : null}
          {view === "settings" ? <SettingsPage /> : null}
        </main>
      </div>
      <span className="sr-only" aria-live="polite">
        {activeSessionId ? "A communication session is active." : "No active session."}
      </span>
    </div>
  );
}
