import { useState, useEffect, type FormEvent } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import type { AdminUserSummary, Role } from "../types/admin";
import {
  PageHeading,
  PageBody,
  Card,
  CardHeader,
  CardContent,
  Badge,
  Button,
  Input,
  Select,
  FormGroup,
  Alert,
  Modal,
  ConfirmDialog,
  EmptyState,
  Spinner,
  PlusIcon,
  SearchIcon,
  StaffIcon,
  ShieldIcon,
  KeyIcon,
} from "../components/ui";

export function Staff() {
  const { user: currentAdmin } = useAdminAuth();
  const [staff, setStaff] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: "success" | "danger" | "warning"; message: string } | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [roleFilter, setRoleFilter] = useState<"all" | "STAFF" | "ADMIN">("all");

  // Create Staff Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createEmail, setCreateEmail] = useState("");
  const [createPhone, setCreatePhone] = useState("");
  const [createRole, setCreateRole] = useState<Role>("STAFF");
  const [createLoading, setCreateLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // Confirmation Dialog State
  const [targetStaff, setTargetStaff] = useState<AdminUserSummary | null>(null);
  const [confirmAction, setConfirmAction] = useState<"activate" | "deactivate" | "reset2fa" | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Invitation-state tracking (backend is the source of truth).
  // pendingInvites[uid] = { invitationId, expiresAt } when a pending setup email
  // is outstanding. The backend returns 200 only when a pending invitation exists.
  const [pendingInvites, setPendingInvites] = useState<Record<string, { invitationId: string; expiresAt: string }>>({});
  const [resendErrors, setResendErrors] = useState<Record<string, string | null>>({});
  const [resendLoading, setResendLoading] = useState<Record<string, boolean>>({});

  const loadStaff = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.listStaff({
        page: 1,
        pageSize: 100,
        search: search.trim() || undefined,
        role: roleFilter !== "all" ? roleFilter : undefined,
        onlyActive: statusFilter === "active" ? true : undefined,
        onlyInactive: statusFilter === "inactive" ? true : undefined,
      });
      setStaff(res.items);
      // Best-effort: probe pending invitations once per staff member.
      // The backend is the single source of truth for whether an invitation
      // is outstanding, so a 404/400 means "no pending invite".
      const next: Record<string, { invitationId: string; expiresAt: string }> = {};
      const errors: Record<string, string | null> = {};
      for (const s of res.items) {
        try {
          const { invitation } = await adminApi.resendInvitation(s.email!);
          next[s.id] = { invitationId: invitation.invitationId, expiresAt: invitation.expiresAt };
          errors[s.id] = null;
        } catch (err: any) {
          // 404/400 => no pending invitation. Not an error for our purposes.
          errors[s.id] = err?.message ?? null;
        }
      }
      setPendingInvites(next);
      setResendErrors(errors);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load staff list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      loadStaff();
    }, 200);
    return () => clearTimeout(timer);
  }, [search, statusFilter, roleFilter]);

  const isInviteExpired = (expiredAt: string, now = Date.now()): boolean => {
    const t = Date.parse(expiredAt);
    return !isNaN(t) && t <= now;
  };

  const handleCreateStaff = async (e: FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateLoading(true);
    try {
      const res = await adminApi.createStaff({
        name: createName.trim(),
        email: createEmail.trim(),
        phone: createPhone.trim() || undefined,
        role: createRole,
      });
      // Only report success if the backend confirmed the invitation email was
      // delivered. If sendMail failed (SMTP misconfigured), the backend returns a
      // 400 and the account is rolled back, so we surface the real error instead
      // of claiming "Invitation sent" when the user never received a link.
      if (res.invitation) {
        setFeedback({ type: "success", message: `Staff account created for ${createName}. Invitation email sent — check your inbox (including spam).` });
      } else {
        // Account created but no invitation (e.g. SMTP down) — tell the admin honestly.
        setFeedback({ type: "warning", message: `Staff account created for ${createName}. An invitation email could not be sent (mail transport unavailable). Use "Resend invite" once SMTP is fixed.` });
      }
      setIsCreateOpen(false);
      setCreateName("");
      setCreateEmail("");
      setCreatePhone("");
      setCreateRole("STAFF");
      loadStaff();
    } catch (err: any) {
      // Backend already rolled back the account if the email failed; surface it.
      setCreateError(err?.message ?? "Failed to create staff member.");
    } finally {
      setCreateLoading(false);
    }
  };

  const executeConfirmedAction = async () => {
    if (!targetStaff || !confirmAction) return;
    setActionLoading(true);
    try {
      if (confirmAction === "activate" || confirmAction === "deactivate") {
        const nextActive = confirmAction === "activate";
        await adminApi.setStaffStatus(targetStaff.id, nextActive);
        setFeedback({
          type: "success",
          message: `${targetStaff.name} is now ${nextActive ? "activated" : "deactivated"}.`,
        });
      } else if (confirmAction === "reset2fa") {
        await adminApi.resetStaff2FA(targetStaff.id);
        setFeedback({
          type: "success",
          message: `2FA reset for ${targetStaff.name}. They will re-enroll upon their next login.`,
        });
      }
      setTargetStaff(null);
      setConfirmAction(null);
      loadStaff();
    } catch (err: any) {
      setFeedback({ type: "danger", message: err?.message ?? "Action failed." });
    } finally {
      setActionLoading(false);
    }
  };

  const resendInviteFor = async (uid: string, email: string) => {
    if (resendLoading[uid]) return;
    setResendLoading((prev) => ({ ...prev, [uid]: true }));
    setResendErrors((prev) => ({ ...prev, [uid]: null }));
    try {
      const { invitation } = await adminApi.resendInvitation(email);
      setPendingInvites((prev) => ({ ...prev, [uid]: { invitationId: invitation.invitationId, expiresAt: invitation.expiresAt } }));
      setStaff((prev) => prev.map((s) => (s.id === uid ? { ...s, email } : s)));
      setFeedback({ type: "success", message: `Resent the setup email to ${email}. Check your inbox (including spam).` });
    } catch (err: any) {
      // 404/400 => no pending invitation (already accepted or expired).
      setResendErrors((prev) => ({ ...prev, [uid]: err?.message ?? "Not available for this staff member." }));
      setFeedback({ type: "warning", message: err?.message ?? "No pending invitation to resend." });
    } finally {
      setResendLoading((prev) => ({ ...prev, [uid]: false }));
    }
  };

  const pendingCount = staff.filter((s) => !s.isActive).length;

  return (
    <PageBody>
      <PageHeading
        eyebrow="Personnel Management"
        title="Staff Directory"
        description="Institutional hearing staff accounts, pending registrations, role governance, and security credentials."
        action={
          <Button variant="primary" icon={<PlusIcon className="w-4 h-4" />} onClick={() => setIsCreateOpen(true)}>
            Add Staff Member
          </Button>
        }
      />

      {feedback && (
        <Alert variant={feedback.type} onClose={() => setFeedback(null)}>
          {feedback.message}
        </Alert>
      )}

      {error && (
        <Alert variant="danger" title="Error Loading Staff">
          {error}
        </Alert>
      )}

      {/* Pending Approvals Notice */}
      {pendingCount > 0 && statusFilter !== "inactive" && (
        <div
          style={{
            background: "var(--admin-warning-soft)",
            border: "1px solid var(--admin-warning-border)",
            borderRadius: "var(--admin-radius-md)",
            padding: "12px 18px",
            marginBottom: "18px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <ShieldIcon className="w-5 h-5" />
            <span style={{ fontSize: "13.5px", fontWeight: "600", color: "var(--admin-warning)" }}>
              {pendingCount} staff {pendingCount === 1 ? "account is" : "accounts are"} currently pending approval.
            </span>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setStatusFilter("inactive")}>
            View Pending Accounts
          </Button>
        </div>
      )}

      {/* Search & Filter Toolbar */}
      <div className="admin-toolbar">
        <div className="admin-toolbar__filters">
          <div className="admin-search-box">
            <SearchIcon className="admin-search-box__icon" />
            <Input
              type="search"
              placeholder="Search by staff name or email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            style={{ width: "160px" }}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Pending / Inactive</option>
          </Select>

          <Select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as any)}
            style={{ width: "150px" }}
          >
            <option value="all">All Roles</option>
            <option value="STAFF">Hearing Staff</option>
            <option value="ADMIN">Administrator</option>
          </Select>

          {(search || statusFilter !== "all" || roleFilter !== "all") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch("");
                setStatusFilter("all");
                setRoleFilter("all");
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        <span style={{ fontSize: "12px", color: "var(--admin-text-secondary)", fontWeight: "600" }}>
          {staff.length} staff {staff.length === 1 ? "member" : "members"}
        </span>
      </div>

      {/* Staff Table */}
      {loading && staff.length === 0 ? (
        <div style={{ display: "flex", justifyContent: "center", padding: "48px 0" }}>
          <Spinner className="w-8 h-8" color="var(--admin-primary)" />
        </div>
      ) : staff.length === 0 ? (
        <Card>
          <EmptyState
            icon={<StaffIcon className="w-6 h-6" />}
            title="No staff members found"
            description={
              search || statusFilter !== "all" || roleFilter !== "all"
                ? "No accounts matched the active filters. Try adjusting your search term."
                : "No staff members are registered yet. Add a staff member to get started."
            }
            action={
              <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)}>
                Add Staff Member
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Staff Member</th>
                <th>Email Address</th>
                <th>Role</th>
                <th>2FA Security</th>
                <th>Account Status</th>
                <th style={{ textAlign: "right" }}>Management Actions</th>
              </tr>
            </thead>
            <tbody>
              {staff.map((s) => {
                const isSelf = s.id === currentAdmin?.id;
                // Interpret invitation state (backend source of truth).
                const pending = pendingInvites[s.id];
                const inviteStatus =
                  pending && !isInviteExpired(pending.expiresAt) ? "pending" :
                  pending ? "expired" : null;
                const hasPending = !!pending && !isInviteExpired(pending.expiresAt);
                const hasExpired = !!pending && isInviteExpired(pending.expiresAt);

                return (
                  <tr key={s.id}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="admin-user-avatar" style={{ width: "28px", height: "28px", fontSize: "11px" }}>
                          {s.name.charAt(0)}
                        </div>
                        <span style={{ fontWeight: "700", color: "var(--admin-text)" }}>
                          {s.name} {isSelf && <span style={{ fontSize: "11px", color: "var(--admin-text-muted)" }}>(You)</span>}
                        </span>
                      </div>
                    </td>
                    <td style={{ color: "var(--admin-text-secondary)", fontFamily: "var(--admin-font-mono)", fontSize: "12.5px" }}>
                      {s.email}
                    </td>
                    <td>
                      <Badge variant={s.role === "ADMIN" ? "purple" : "teal"} label={s.role} />
                    </td>
                    <td>
                      <Badge
                        variant={s.twoFactorEnabled ? "success" : "warning"}
                        label={s.twoFactorEnabled ? "2FA Enabled" : "2FA Pending"}
                      />
                    </td>
                    <td>
                      <Badge
                        variant={s.isActive ? "success" : "danger"}
                        label={s.isActive ? "Active" : "Pending / Inactive"}
                      />
                    </td>
                    <td>
                      <div className="admin-table__actions">
                        {!isSelf && (
                          <>
                            <button
                              className="admin-btn admin-btn--ghost admin-btn--sm"
                              style={{ color: s.isActive ? "var(--admin-danger)" : "var(--admin-success)" }}
                              onClick={() => {
                                setTargetStaff(s);
                                setConfirmAction(s.isActive ? "deactivate" : "activate");
                              }}
                            >
                              {s.isActive ? "Deactivate" : "Approve & Activate"}
                            </button>

                            {s.twoFactorEnabled && (
                              <button
                                className="admin-btn admin-btn--ghost admin-btn--sm"
                                onClick={() => {
                                  setTargetStaff(s);
                                  setConfirmAction("reset2fa");
                                }}
                                title="Reset 2FA credentials"
                              >
                                Reset 2FA
                              </button>
                            )}

                            {!isSelf && s.isActive && (
                              <button
                                className="admin-btn admin-btn--ghost admin-btn--sm"
                                onClick={() => resendInviteFor(s.id, s.email!)}
                                disabled={resendLoading[s.id]}
                              >
                                {resendLoading[s.id] ? "Resending…" : hasPending ? "Resent" : hasExpired ? "Re-invite" : "Resend Setup Email"}
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Staff Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Register New Staff Member"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsCreateOpen(false)} disabled={createLoading}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleCreateStaff} loading={createLoading} disabled={!createName || !createEmail}>
              Create Staff Account
            </Button>
          </>
        }
      >
        <form onSubmit={handleCreateStaff}>
          {createError && (
            <Alert variant="danger">
              {createError}
            </Alert>
          )}

          <FormGroup label="Full Name">
            <Input
              type="text"
              placeholder="e.g. Samuel Kimani"
              value={createName}
              onChange={(e) => setCreateName(e.target.value)}
              required
              autoFocus
            />
          </FormGroup>

          <FormGroup label="Institutional Email Address">
            <Input
              type="email"
              placeholder="e.g. samuel@signova.test"
              value={createEmail}
              onChange={(e) => setCreateEmail(e.target.value)}
              required
            />
          </FormGroup>

          <FormGroup label="Phone Number" optional>
            <Input
              type="tel"
              placeholder="+254 700 000 000"
              value={createPhone}
              onChange={(e) => setCreatePhone(e.target.value)}
            />
          </FormGroup>

          <FormGroup label="Organizational Role">
            <Select value={createRole} onChange={(e) => setCreateRole(e.target.value as Role)}>
              <option value="STAFF">Hearing Staff (Counter Operator)</option>
              <option value="ADMIN">Institutional Administrator</option>
            </Select>
          </FormGroup>
        </form>
      </Modal>

      {/* Consequential Action Confirmation */}
      <ConfirmDialog
        isOpen={!!targetStaff && !!confirmAction}
        onClose={() => {
          setTargetStaff(null);
          setConfirmAction(null);
        }}
        onConfirm={executeConfirmedAction}
        loading={actionLoading}
        title={
          confirmAction === "activate"
            ? "Approve & Activate Account"
            : confirmAction === "deactivate"
            ? "Deactivate Staff Account"
            : "Reset Two-Factor Authentication"
        }
        message={
          confirmAction === "activate"
            ? `Are you sure you want to approve access for ${targetStaff?.name}? They will immediately be able to sign in and operate service counters.`
            : confirmAction === "deactivate"
            ? `Are you sure you want to deactivate ${targetStaff?.name}? Any active sessions will be terminated and their counter access revoked.`
            : `Are you sure you want to reset 2FA for ${targetStaff?.name}? Their existing authenticator key will be revoked and they will be forced to enroll a new authenticator upon their next login.`
        }
        confirmText={
          confirmAction === "activate"
            ? "Approve Staff"
            : confirmAction === "deactivate"
            ? "Deactivate Staff"
            : "Reset 2FA"
        }
        confirmVariant={confirmAction === "activate" ? "primary" : "danger"}
      />
    </PageBody>
  );
}
