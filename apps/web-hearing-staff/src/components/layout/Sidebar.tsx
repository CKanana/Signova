import { useEffect, useState } from "react";
import { useStaffWorkspace } from "../../context/StaffWorkspaceContext";
import { useStaffAuth } from "../../context/AuthContext";
import { Button } from "../ui/Button";
import { Badge, tellerBadge } from "../ui/Badge";
import {
  IconDashboard,
  IconHistory,
  IconLogout,
  IconMessage,
  IconSettings,
} from "../ui/Icons";
import logoHorizontal from "../../assets/brand/signova-logo-horizontal.png";

/**
 * Persistent sidebar — Signova branding, organization, staff identity,
 * navigation, and the assigned-teller availability control.
 */

export type StaffViewName = "dashboard" | "session" | "history" | "settings";

interface SidebarProps {
  current: StaffViewName;
  onNavigate: (view: StaffViewName) => void;
  hasActiveSession: boolean;
  hasPendingRequest: boolean;
}

function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const ROLE_LABEL: Record<string, string> = {
  STAFF: "Service staff",
  ADMIN: "Administrator",
};

export function Sidebar({ current, onNavigate, hasActiveSession, hasPendingRequest }: SidebarProps) {
  const { organization, user, assignedTellers, isSavingAvailability, setAvailability } =
    useStaffWorkspace();
  const { signOut } = useStaffAuth();

  const [collapsed, setCollapsed] = useState(false);

  // Track viewport so the CSS rail collapse stays in sync for the labels.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 980px)");
    const update = () => setCollapsed(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  const navItems: Array<{ id: StaffViewName; label: string; icon: React.ReactNode }> = [
    { id: "dashboard", label: "Dashboard", icon: <IconDashboard /> },
    { id: "session", label: "Active session", icon: <IconMessage /> },
    { id: "history", label: "Session history", icon: <IconHistory /> },
    { id: "settings", label: "Account", icon: <IconSettings /> },
  ];

  const teller = assignedTellers[0];

  return (
    <aside className="staff-sidebar" aria-label="Staff navigation">
      <div className="staff-sidebar__brand">
        <img src={logoHorizontal} alt="Signova" className="staff-sidebar__logo" />
      </div>

      {organization ? (
        <div className="staff-sidebar__org">
          <div className="staff-sidebar__org-label">Organization</div>
          <div className="staff-sidebar__org-name">{organization.name}</div>
          <div className="staff-sidebar__org-sub">{organization.serviceName}</div>
        </div>
      ) : null}

      <nav className="staff-sidebar__nav" aria-label="Main">
        <div className="staff-sidebar__section-label">Workspace</div>
        {navItems.map((item) => {
          const badgeCount =
            item.id === "session" && hasPendingRequest
              ? 1
              : item.id === "session" && hasActiveSession
                ? undefined
                : undefined;
          return (
            <button
              key={item.id}
              type="button"
              className={`staff-navitem${current === item.id ? " staff-navitem--active" : ""}`}
              onClick={() => onNavigate(item.id)}
              aria-current={current === item.id ? "page" : undefined}
            >
              <span className="staff-navitem__icon">{item.icon}</span>
              <span>{item.label}</span>
              {badgeCount ? (
                <span className="staff-navitem__badge" aria-label="1 incoming request">
                  {badgeCount}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>

      <div className="staff-sidebar__footer">
        {teller ? (
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
        ) : null}

        {user ? (
          <div className="staff-identity">
            <span className="staff-avatar" aria-hidden="true">
              {initials(user.name)}
            </span>
            <div className="staff-identity__meta">
              <div className="staff-identity__name">{user.name}</div>
              <div className="staff-identity__role">{ROLE_LABEL[user.role] ?? user.role}</div>
            </div>
          </div>
        ) : null}

        <Button variant="ghost" size="sm" block onClick={() => void signOut()}>
          <IconLogout />
          Sign out
        </Button>
      </div>

      {collapsed ? null : null}
    </aside>
  );
}
