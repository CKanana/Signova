import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import type { OverviewMetrics } from "../types/admin";
import {
  PageHeading,
  PageBody,
  StatCard,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Button,
  Alert,
  Spinner,
  StaffIcon,
  TellerIcon,
  SessionIcon,
  ShieldIcon,
  BuildingIcon,
  RefreshIcon,
} from "../components/ui";

export function Overview() {
  const { user, organization, setOrganization } = useAdminAuth();
  const [metrics, setMetrics] = useState<OverviewMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.getOverview();
      setMetrics(res.metrics);
      if (res.metrics.organization) {
        setOrganization(res.metrics.organization);
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to load organization overview metrics.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
  }, []);

  const org = metrics?.organization ?? organization;

  return (
    <PageBody>
      <PageHeading
        eyebrow="Institutional Administration"
        title="Executive Overview"
        description="Operational telemetry for service counters, staff availability, and sign-language communication sessions."
        action={
          <Button variant="secondary" size="sm" onClick={loadMetrics} loading={loading} icon={<RefreshIcon className="w-3.5 h-3.5" />}>
            Refresh Telemetry
          </Button>
        }
      />

      {error && (
        <Alert variant="danger" title="Telemetry Unavailable">
          {error}
        </Alert>
      )}

      {loading && !metrics ? (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", padding: "64px 0" }}>
          <Spinner className="w-8 h-8" color="var(--admin-primary)" />
        </div>
      ) : metrics ? (
        <>
          {/* Key Metrics Row */}
          <div className="admin-stats-grid">
            <StatCard
              label="Active Staff"
              value={metrics.staffActiveCount}
              sub={`of ${metrics.staffCount} total registered`}
              icon={<StaffIcon className="w-4 h-4" />}
              variant="green"
            />
            <StatCard
              label="Pending Approvals"
              value={metrics.staffPendingCount}
              sub={metrics.staffPendingCount > 0 ? "Requires administrator review" : "All staff approved"}
              icon={<ShieldIcon className="w-4 h-4" />}
              variant={metrics.staffPendingCount > 0 ? "amber" : "green"}
            />
            <StatCard
              label="Available Tellers"
              value={metrics.tellerAvailableCount}
              sub={`${metrics.tellerBusyCount} in service · ${metrics.tellerOfflineCount} offline`}
              icon={<TellerIcon className="w-4 h-4" />}
              variant="teal"
            />
            <StatCard
              label="Active Sessions"
              value={metrics.activeSessionCount}
              sub={`${metrics.totalSessionCount} total sessions recorded`}
              icon={<SessionIcon className="w-4 h-4" />}
              variant="purple"
            />
          </div>

          {/* Operational Status Grids */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "20px", marginBottom: "24px" }}>
            {/* Tellers & Counters Panel */}
            <Card>
              <CardHeader
                title="Service Counter Status"
                subtitle="Live status across institutional service desks"
                action={
                  <Link to="/admin/tellers" className="admin-btn admin-btn--ghost admin-btn--sm">
                    Manage Tellers →
                  </Link>
                }
              />
              <CardContent>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--admin-surface-muted)", borderRadius: "var(--admin-radius-md)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--admin-teal)" }} />
                      <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--admin-text)" }}>Available &amp; Ready</span>
                    </div>
                    <Badge variant="teal" label={`${metrics.tellerAvailableCount} Tellers`} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--admin-surface-muted)", borderRadius: "var(--admin-radius-md)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--admin-warning)" }} />
                      <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--admin-text)" }}>In Service (Busy)</span>
                    </div>
                    <Badge variant="warning" label={`${metrics.tellerBusyCount} Counters`} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--admin-surface-muted)", borderRadius: "var(--admin-radius-md)" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ width: "10px", height: "10px", borderRadius: "50%", background: "var(--admin-text-muted)" }} />
                      <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--admin-text)" }}>Offline</span>
                    </div>
                    <Badge variant="neutral" label={`${metrics.tellerOfflineCount} Counters`} />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Staffing & Security Panel */}
            <Card>
              <CardHeader
                title="Staff Personnel &amp; Approvals"
                subtitle="Institutional staff members and role status"
                action={
                  <Link to="/admin/staff" className="admin-btn admin-btn--ghost admin-btn--sm">
                    Staff Directory →
                  </Link>
                }
              />
              <CardContent>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--admin-surface-muted)", borderRadius: "var(--admin-radius-md)" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--admin-text)" }}>Active Hearing Staff</span>
                    <Badge variant="success" label={`${metrics.staffActiveCount} Active`} />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--admin-surface-muted)", borderRadius: "var(--admin-radius-md)" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--admin-text)" }}>Pending Administrator Approval</span>
                    <Badge
                      variant={metrics.staffPendingCount > 0 ? "warning" : "neutral"}
                      label={`${metrics.staffPendingCount} Pending`}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "var(--admin-surface-muted)", borderRadius: "var(--admin-radius-md)" }}>
                    <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--admin-text)" }}>Total Registered Accounts</span>
                    <Badge variant="purple" label={`${metrics.staffCount} Total`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Organization Information Panel */}
          {org && (
            <Card>
              <CardHeader
                title="Organization Profile"
                subtitle="Active service location and security policies"
                action={
                  <Link to="/admin/settings" className="admin-btn admin-btn--secondary admin-btn--sm">
                    Configure Settings
                  </Link>
                }
              />
              <CardContent>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Institution Name
                    </span>
                    <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)", marginTop: "4px" }}>
                      {org.name} ({org.shortName})
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Service Desk Label
                    </span>
                    <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)", marginTop: "4px" }}>
                      {org.serviceName}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Counter Tablet Display
                    </span>
                    <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)", marginTop: "4px" }}>
                      {org.counterLabel}
                    </p>
                  </div>

                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                      Domain Registration Policy
                    </span>
                    <div style={{ marginTop: "4px" }}>
                      <Badge
                        variant={org.restrictRegistrationByDomain ? "teal" : "neutral"}
                        label={org.restrictRegistrationByDomain ? "Domain Restricted" : "Open Registration"}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      ) : null}
    </PageBody>
  );
}
