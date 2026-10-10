import { useCallback, useEffect, useState } from "react";
import { api, type SessionDetail } from "../services/api";
import { useStaffWorkspace } from "../context/StaffWorkspaceContext";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState, ErrorBanner, SkeletonCard } from "../components/ui/States";

/**
 * Session history — real backend data only (GET /api/sessions).
 * Shows date/time, teller, method, status, message count, duration, and
 * end reason where the backend provides them. Nothing is fabricated.
 */

type StatusFilter = "all" | "ACTIVE" | "ENDED";

function statusBadge(status: SessionDetail["status"]) {
  switch (status) {
    case "ACTIVE":
      return { tone: "live" as const, label: "Active" };
    case "CONNECTING":
      return { tone: "warn" as const, label: "Connecting" };
    default:
      return { tone: "neutral" as const, label: "Ended" };
  }
}

function endReasonLabel(reason?: string): string {
  switch (reason) {
    case "USER_ENDED":
      return "Ended by user";
    case "STAFF_ENDED":
      return "Ended by staff";
    case "TIMEOUT":
      return "Timed out";
    case "ERROR":
      return "Ended by error";
    default:
      return "—";
  }
}

function formatDateTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function durationLabel(startedAt: string, endedAt?: string): string {
  if (!endedAt) return "—";
  const ms = new Date(endedAt).getTime() - new Date(startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
}

function tellerName(session: SessionDetail, tellers: Array<{ _id: string; name: string }>): string {
  if (typeof session.teller === "object") return session.teller.name;
  return tellers.find((t) => t._id === session.teller)?.name ?? "—";
}

export function HistoryPage() {
  const { tellers, user } = useStaffWorkspace();
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [sessions, setSessions] = useState<SessionDetail[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { sessions: list } = await api.listSessions(
        filter === "all" ? {} : { status: filter },
      );
      setSessions(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load session history.");
    } finally {
      setIsLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  const roleHint =
    user?.role === "ADMIN"
      ? "As an administrator you see every session in the organization."
      : "Showing sessions for your organization.";

  return (
    <div className="staff-stack">
      <div>
        <div className="staff-eyebrow">History</div>
        <h2 className="staff-section-title">Session history</h2>
        <p className="staff-section-lede">{roleHint}</p>
      </div>

      {error ? <ErrorBanner message={error} action={<Button size="sm" variant="secondary" onClick={() => void load()}>Retry</Button>} /> : null}

      <div className="staff-row staff-row--wrap">
        {(["all", "ACTIVE", "ENDED"] as StatusFilter[]).map((value) => (
          <Button
            key={value}
            size="sm"
            variant={filter === value ? "primary" : "secondary"}
            onClick={() => setFilter(value)}
          >
            {value === "all" ? "All" : value === "ACTIVE" ? "Active" : "Ended"}
          </Button>
        ))}
        <div style={{ marginLeft: "auto" }}>
          <Button size="sm" variant="ghost" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="staff-stack">
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </div>
      ) : sessions && sessions.length === 0 ? (
        <Card>
          <EmptyState title="No sessions yet">
            Completed conversations will be listed here with their details.
          </EmptyState>
        </Card>
      ) : sessions ? (
        <Card>
          <div className="staff-table-wrap">
            <table className="staff-table">
              <caption className="sr-only">Session history</caption>
              <thead>
                <tr>
                  <th scope="col">Started</th>
                  <th scope="col">Teller</th>
                  <th scope="col">Method</th>
                  <th scope="col">Status</th>
                  <th scope="col">Messages</th>
                  <th scope="col">Duration</th>
                  <th scope="col">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => {
                  const badge = statusBadge(s.status);
                  return (
                    <tr key={s._id}>
                      <td>{formatDateTime(s.startedAt)}</td>
                      <td>{tellerName(s, tellers)}</td>
                      <td>{s.method === "sign" ? "Sign" : "Text"}</td>
                      <td>
                        <Badge tone={badge.tone} dot>
                          {badge.label}
                        </Badge>
                      </td>
                      <td>{s.messageCount}</td>
                      <td>{durationLabel(s.startedAt, s.endedAt)}</td>
                      <td>{endReasonLabel(s.endReason)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
