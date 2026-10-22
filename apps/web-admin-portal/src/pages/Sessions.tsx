import { useState, useEffect } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import type { AdminSession, SessionStatus, Teller } from "../types/admin";
import {
  PageHeading,
  PageBody,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Button,
  Select,
  Alert,
  Drawer,
  EmptyState,
  Spinner,
  SessionIcon,
  RefreshIcon,
  ClockIcon,
  TellerIcon,
  StaffIcon,
} from "../components/ui";

function formatTimestamp(isoString?: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoString;
  }
}

function calculateDuration(start?: string, end?: string): string {
  if (!start) return "—";
  try {
    const s = new Date(start).getTime();
    const e = end ? new Date(end).getTime() : Date.now();
    const diffSec = Math.floor((e - s) / 1000);
    if (diffSec < 60) return `${diffSec}s`;
    const min = Math.floor(diffSec / 60);
    const sec = diffSec % 60;
    return `${min}m ${sec}s`;
  } catch {
    return "—";
  }
}

export function Sessions() {
  const { user } = useAdminAuth();
  const [sessions, setSessions] = useState<AdminSession[]>([]);
  const [tellers, setTellers] = useState<Teller[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [statusFilter, setStatusFilter] = useState<"all" | SessionStatus>("all");
  const [tellerFilter, setTellerFilter] = useState<string>("all");

  // Selected session for Detail Drawer
  const [selectedSession, setSelectedSession] = useState<AdminSession | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sessionsRes, tellersRes] = await Promise.all([
        adminApi.listSessions({
          page: 1,
          pageSize: 100,
          status: statusFilter !== "all" ? statusFilter : undefined,
          tellerId: tellerFilter !== "all" ? tellerFilter : undefined,
        }),
        adminApi.listTellers({ pageSize: 100 }),
      ]);
      setSessions(sessionsRes.items);
      setTellers(tellersRes.items);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load session history.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, [statusFilter, tellerFilter]);

  return (
    <PageBody>
      <PageHeading
        eyebrow="Communication Telemetry"
        title="Translation Sessions"
        description="Historical and active sign-language communication sessions across institutional service desks."
        action={
          <Button variant="secondary" size="sm" onClick={loadSessions} loading={loading} icon={<RefreshIcon className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" title="Error Loading Sessions">
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ width: "170px" }}
          >
            <option value="all">All Session States</option>
            <option value="ACTIVE">Active (Live)</option>
            <option value="CONNECTING">Connecting</option>
            <option value="ENDED">Ended</option>
          </Select>

          <Select
            value={tellerFilter}
            onChange={(e) => setTellerFilter(e.target.value)}
            style={{ width: "220px" }}
          >
            <option value="all">All Service Counters</option>
            {tellers.map((t) => (
              <option key={t.id} value={t.id}>
                Counter {t.counterNumber} ({t.name})
              </option>
            ))}
          </Select>

          {(statusFilter !== "all" || tellerFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStatusFilter("all");
                setTellerFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <span style={{ fontSize: "12px", color: "var(--admin-text-secondary)", fontWeight: "600" }}>
          {sessions.length} recorded {sessions.length === 1 ? "session" : "sessions"}
        </span>
      </div>

      {/* Sessions Table */}
      {loading && sessions.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <Spinner className="w-8 h-8" color="var(--admin-primary)" />
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <EmptyState
            icon={<SessionIcon className="w-6 h-6" />}
            title="No sessions found"
            description={
              statusFilter !== "all" || tellerFilter !== "all"
                ? "No communication sessions matched the selected filters."
                : "No communication sessions have been initiated at this organization yet."
            }
          />
        </Card>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Service Counter</th>
                <th>Pairing Code</th>
                <th>Communication Mode</th>
                <th>Started Time</th>
                <th>Duration</th>
                <th>Session State</th>
                <th>Messages</th>
                <th style={{ textAlign: "right" }}>Details</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span style={{ fontWeight: "700", color: "var(--admin-text)" }}>
                        {s.teller?.name ?? "Counter Service"}
                      </span>
                      <span style={{ fontSize: "11.5px", color: "var(--admin-text-secondary)" }}>
                        ID: {s.teller?.id.slice(-6) ?? "—"}
                      </span>
                    </div>
                  </td>

                  <td>
                    {s.pairingCode ? (
                      <span
                        style={{
                          fontFamily: "var(--admin-font-mono)",
                          fontSize: "12px",
                          fontWeight: "700",
                          padding: "2px 6px",
                          background: "var(--admin-surface-muted)",
                          border: "1px solid var(--admin-border-subtle)",
                          borderRadius: "var(--admin-radius-sm)",
                        }}
                      >
                        {s.pairingCode}
                      </span>
                    ) : (
                      <span style={{ color: "var(--admin-text-muted)" }}>—</span>
                    )}
                  </td>

                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Badge
                        variant={s.method === "sign" ? "purple" : "teal"}
                        label={s.method === "sign" ? "Sign Language" : "Text Chat"}
                      />
                    </div>
                  </td>

                  <td style={{ color: "var(--admin-text-secondary)", fontSize: "12.5px" }}>
                    {formatTimestamp(s.startedAt)}
                  </td>

                  <td style={{ color: "var(--admin-text)", fontSize: "12.5px", fontFamily: "var(--admin-font-mono)" }}>
                    {calculateDuration(s.startedAt, s.endedAt)}
                  </td>

                  <td>
                    <Badge
                      status={s.status}
                      label={s.status === "ACTIVE" ? "Active Call" : s.status === "CONNECTING" ? "Connecting" : "Ended"}
                    />
                  </td>

                  <td>
                    <span style={{ fontWeight: "700", color: "var(--admin-text)", fontSize: "12.5px" }}>
                      {s.messageCount} msgs
                    </span>
                  </td>

                  <td>
                    <div className="admin-table__actions">
                      <button
                        className="admin-btn admin-btn--ghost admin-btn--sm"
                        onClick={() => setSelectedSession(s)}
                      >
                        Inspect
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Session Details Drawer */}
      <Drawer
        isOpen={!!selectedSession}
        onClose={() => setSelectedSession(null)}
        title="Session Inspection"
      >
        {selectedSession && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <Badge
                status={selectedSession.status}
                label={
                  selectedSession.status === "ACTIVE"
                    ? "Active Session"
                    : selectedSession.status === "CONNECTING"
                    ? "Connecting"
                    : "Completed Session"
                }
              />
              <span style={{ fontSize: "12px", color: "var(--admin-text-muted)" }}>
                ID: {selectedSession.id}
              </span>
            </div>

            {/* Metrics Breakdown */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ background: "var(--admin-surface-muted)", padding: "12px", borderRadius: "var(--admin-radius-md)" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase" }}>
                  Communication Mode
                </span>
                <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)", marginTop: "3px" }}>
                  {selectedSession.method === "sign" ? "Kenyan Sign Language" : "Two-way Text"}
                </p>
              </div>

              <div style={{ background: "var(--admin-surface-muted)", padding: "12px", borderRadius: "var(--admin-radius-md)" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase" }}>
                  Total Duration
                </span>
                <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)", marginTop: "3px" }}>
                  {calculateDuration(selectedSession.startedAt, selectedSession.endedAt)}
                </p>
              </div>
            </div>

            {/* Counter Information */}
            <div style={{ border: "1px solid var(--admin-border-subtle)", borderRadius: "var(--admin-radius-md)", padding: "14px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: "800", color: "var(--admin-text)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <TellerIcon className="w-4 h-4" /> Service Counter
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--admin-text-secondary)" }}>Counter Name:</span>
                  <span style={{ fontWeight: "600", color: "var(--admin-text)" }}>{selectedSession.teller?.name ?? "—"}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--admin-text-secondary)" }}>Pairing Code:</span>
                  <span style={{ fontFamily: "var(--admin-font-mono)", fontWeight: "700" }}>{selectedSession.pairingCode ?? "—"}</span>
                </div>
              </div>
            </div>

            {/* Timestamp Information */}
            <div style={{ border: "1px solid var(--admin-border-subtle)", borderRadius: "var(--admin-radius-md)", padding: "14px" }}>
              <h3 style={{ fontSize: "13px", fontWeight: "800", color: "var(--admin-text)", marginBottom: "10px", display: "flex", alignItems: "center", gap: "6px" }}>
                <ClockIcon className="w-4 h-4" /> Telemetry Timeline
              </h3>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12.5px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--admin-text-secondary)" }}>Started At:</span>
                  <span style={{ color: "var(--admin-text)" }}>{formatTimestamp(selectedSession.startedAt)}</span>
                </div>
                {selectedSession.endedAt && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--admin-text-secondary)" }}>Ended At:</span>
                    <span style={{ color: "var(--admin-text)" }}>{formatTimestamp(selectedSession.endedAt)}</span>
                  </div>
                )}
                {selectedSession.endReason && (
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "var(--admin-text-secondary)" }}>Termination Reason:</span>
                    <Badge variant="neutral" label={selectedSession.endReason} />
                  </div>
                )}
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--admin-text-secondary)" }}>Total Messages Transferred:</span>
                  <span style={{ fontWeight: "700", color: "var(--admin-primary)" }}>{selectedSession.messageCount}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </PageBody>
  );
}
