import { useState, useEffect } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import type { AuditLogEntry } from "../types/admin";
import {
  PageHeading,
  PageBody,
  Card,
  Badge,
  Button,
  Select,
  Alert,
  Modal,
  EmptyState,
  Spinner,
  AuditIcon,
  RefreshIcon,
} from "../components/ui";

const ACTION_LABELS: Record<string, { label: string; variant: "purple" | "teal" | "success" | "warning" | "danger" | "neutral" }> = {
  STAFF_CREATE: { label: "Staff Created", variant: "success" },
  STAFF_UPDATE: { label: "Staff Updated", variant: "purple" },
  STAFF_ACTIVATE: { label: "Staff Activated", variant: "success" },
  STAFF_DEACTIVATE: { label: "Staff Deactivated", variant: "danger" },
  STAFF_2FA_RESET: { label: "2FA Reset", variant: "warning" },
  TELLER_CREATE: { label: "Counter Created", variant: "teal" },
  TELLER_UPDATE: { label: "Counter Updated", variant: "teal" },
  TELLER_FREE: { label: "Counter Freed", variant: "teal" },
  TELLER_BUSY: { label: "Counter Busy", variant: "warning" },
  TELLER_OFFLINE: { label: "Counter Offline", variant: "neutral" },
  ORG_UPDATE: { label: "Settings Updated", variant: "purple" },
  SESSION_ENDED: { label: "Session Terminated", variant: "neutral" },
  LOGIN_SUCCESS: { label: "Admin Sign-In", variant: "success" },
  LOGOUT: { label: "Admin Sign-Out", variant: "neutral" },
};

function formatAuditTimestamp(isoString?: string): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return isoString;
  }
}

export function Audit() {
  const { user } = useAdminAuth();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Pagination & Filtering
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const pageSize = 25;

  // Selected Log for inspection modal
  const [inspectingLog, setInspectingLog] = useState<AuditLogEntry | null>(null);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listAuditLogs({
        page,
        pageSize,
        action: actionFilter !== "all" ? actionFilter : undefined,
      });
      setLogs(res.items);
      setTotalCount(res.total);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load audit trail.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [actionFilter, page]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <PageBody>
      <PageHeading
        eyebrow="Compliance &amp; Governance"
        title="Audit Records"
        description="Immutable administrative activity logs, security mutations, and operational events scoped to this organization."
        action={
          <Button variant="secondary" size="sm" onClick={loadLogs} loading={loading} icon={<RefreshIcon className="w-3.5 h-3.5" />}>
            Refresh Logs
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" title="Error Loading Audit Trail">
          {error}
        </Alert>
      )}

      {/* Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <Select
            value={actionFilter}
            onChange={(e) => {
              setActionFilter(e.target.value);
              setPage(1);
            }}
            style={{ width: "230px" }}
          >
            <option value="all">All Administrative Actions</option>
            <option value="STAFF_CREATE">Staff Created</option>
            <option value="STAFF_UPDATE">Staff Updated</option>
            <option value="STAFF_ACTIVATE">Staff Activated</option>
            <option value="STAFF_DEACTIVATE">Staff Deactivated</option>
            <option value="STAFF_2FA_RESET">2FA Credential Reset</option>
            <option value="TELLER_CREATE">Counter Registered</option>
            <option value="TELLER_UPDATE">Counter Updated</option>
            <option value="ORG_UPDATE">Organization Settings Updated</option>
            <option value="LOGIN_SUCCESS">Admin Authentication</option>
            <option value="LOGOUT">Admin Sign-Out</option>
          </Select>

          {actionFilter !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setActionFilter("all");
                setPage(1);
              }}
            >
              Clear filter
            </Button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "12.5px", color: "var(--admin-text-secondary)" }}>
            Page {page} of {totalPages} ({totalCount} total events)
          </span>

          <div style={{ display: "flex", gap: "6px" }}>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1 || loading}
            >
              Previous
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || loading}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Audit Log Table */}
      {loading && logs.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <Spinner className="w-8 h-8" color="var(--admin-primary)" />
        </div>
      ) : logs.length === 0 ? (
        <Card>
          <EmptyState
            icon={<AuditIcon className="w-6 h-6" />}
            title="No audit events found"
            description={
              actionFilter !== "all"
                ? "No audit records matched the selected action filter."
                : "No administrative activities recorded yet for this organization."
            }
          />
        </Card>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Timestamp</th>
                <th>Administrative Action</th>
                <th>Actor (Principal)</th>
                <th>Target Resource</th>
                <th>Origin IP</th>
                <th style={{ textAlign: "right" }}>Payload</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => {
                const actionInfo = ACTION_LABELS[log.action] ?? {
                  label: log.action.replace(/_/g, " "),
                  variant: "neutral",
                };

                return (
                  <tr key={log.id}>
                    <td style={{ color: "var(--admin-text-secondary)", fontSize: "12.5px", whiteSpace: "nowrap" }}>
                      {formatAuditTimestamp(log.createdAt)}
                    </td>

                    <td>
                      <Badge variant={actionInfo.variant} label={actionInfo.label} />
                    </td>

                    <td>
                      <span style={{ fontWeight: "700", color: "var(--admin-text)", fontSize: "13px" }}>
                        {log.actor?.name ?? "System / Admin"}
                      </span>
                    </td>

                    <td style={{ color: "var(--admin-text-secondary)", fontSize: "12.5px", fontFamily: "var(--admin-font-mono)" }}>
                      {log.target || "—"}
                    </td>

                    <td style={{ color: "var(--admin-text-muted)", fontSize: "12px", fontFamily: "var(--admin-font-mono)" }}>
                      {log.ip || "127.0.0.1"}
                    </td>

                    <td>
                      <div className="admin-table__actions">
                        <button
                          className="admin-btn admin-btn--ghost admin-btn--sm"
                          onClick={() => setInspectingLog(log)}
                        >
                          Inspect JSON
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* JSON Payload Inspection Modal */}
      <Modal
        isOpen={!!inspectingLog}
        onClose={() => setInspectingLog(null)}
        title="Audit Record Inspection"
        maxWidth="600px"
      >
        {inspectingLog && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
              <span style={{ color: "var(--admin-text-secondary)" }}>Event ID:</span>
              <span style={{ fontFamily: "var(--admin-font-mono)", fontWeight: "700" }}>{inspectingLog.id}</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
              <span style={{ color: "var(--admin-text-secondary)" }}>Recorded Timestamp:</span>
              <span style={{ color: "var(--admin-text)" }}>{inspectingLog.createdAt}</span>
            </div>
            {inspectingLog.userAgent && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12px" }}>
                <span style={{ color: "var(--admin-text-secondary)" }}>User Agent:</span>
                <span style={{ fontFamily: "var(--admin-font-mono)", background: "var(--admin-surface-muted)", padding: "6px", borderRadius: "var(--admin-radius-sm)", wordBreak: "break-all" }}>
                  {inspectingLog.userAgent}
                </span>
              </div>
            )}
            <div style={{ marginTop: "8px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase" }}>
                Recorded Metadata
              </span>
              <pre
                style={{
                  background: "var(--admin-surface-muted)",
                  border: "1px solid var(--admin-border-subtle)",
                  borderRadius: "var(--admin-radius-md)",
                  padding: "12px",
                  fontSize: "12px",
                  fontFamily: "var(--admin-font-mono)",
                  overflowX: "auto",
                  marginTop: "6px",
                  maxHeight: "260px",
                }}
              >
                {JSON.stringify(inspectingLog.meta ?? { action: inspectingLog.action, target: inspectingLog.target }, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </PageBody>
  );
}
