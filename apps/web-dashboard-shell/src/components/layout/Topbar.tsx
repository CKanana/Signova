import { useStaffWorkspace } from "../../context/StaffWorkspaceContext";
import { Badge } from "../ui/Badge";
import type { ConnectionState } from "../../services/socket";

/**
 * View header: title, context subtitle, and the live realtime connection
 * state. Connection states are shown with text (not colour alone):
 * Connected · Connecting · Reconnecting · Disconnected.
 */

interface TopbarProps {
  title: string;
  subtitle?: string;
}

function connectionBadge(state: ConnectionState) {
  switch (state) {
    case "connected":
      return { tone: "live" as const, label: "Live", pulse: true };
    case "connecting":
      return { tone: "neutral" as const, label: "Connecting…", pulse: true };
    case "reconnecting":
      return { tone: "warn" as const, label: "Reconnecting…", pulse: true };
    case "disconnected":
      return { tone: "danger" as const, label: "Disconnected", pulse: false };
    default:
      return { tone: "offline" as const, label: "Offline", pulse: false };
  }
}

export function Topbar({ title, subtitle }: TopbarProps) {
  const { connection } = useStaffWorkspace();
  const badge = connectionBadge(connection);

  return (
    <header className="staff-topbar">
      <div className="staff-topbar__titles">
        <h1 className="staff-topbar__title">{title}</h1>
        {subtitle ? <div className="staff-topbar__subtitle">{subtitle}</div> : null}
      </div>
      <div className="staff-topbar__spacer" />
      <Badge
        tone={badge.tone}
        dot
        pulse={badge.pulse}
      >
        {badge.label}
      </Badge>
    </header>
  );
}
