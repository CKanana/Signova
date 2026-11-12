import React, { useState } from "react";
import { api } from "../services/api";
import { useStaffAuth } from "../context/AuthContext";
import { useStaffWorkspace } from "../context/StaffWorkspaceContext";
import { Card, CardHeader } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { ErrorBanner, LoadingState } from "../components/ui/States";

/** Eye-open icon for password show */
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

/** Eye-off icon for password hidden */
function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );
}

/**
 * Account settings: profile from GET /api/auth/me, 2FA status, and the
 * change-password flow (POST /api/auth/change-password — verified to exist
 * in the Phase 1 backend). Sign-out lives in the sidebar.
 */

export function SettingsPage() {
  const { user, signOut } = useStaffAuth();
  const { organization } = useStaffWorkspace();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState(false);

  // Password visibility state
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(false);
    if (newPassword.length < 10) {
      setFormError("New passwords must be at least 10 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFormError("The new passwords do not match.");
      return;
    }
    setIsSaving(true);
    try {
      await api.changePassword(currentPassword, newPassword);
      setFormSuccess(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not change the password.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="staff-stack">
      <div className="staff-grid staff-grid--2">
        <Card>
          <CardHeader title="Profile" />
          <div className="staff-card__body">
            {user ? (
              <dl className="staff-kv">
                <dt>Name</dt>
                <dd>{user.name}</dd>
                <dt>Email</dt>
                <dd>{user.email ?? "—"}</dd>
                <dt>Role</dt>
                <dd>{user.role === "ADMIN" ? "Administrator" : "Service staff"}</dd>
                <dt>Organization</dt>
                <dd>{organization?.name ?? "—"}</dd>
              </dl>
            ) : (
              <LoadingState />
            )}
          </div>
        </Card>

        <Card>
          <CardHeader title="Security" />
          <div className="staff-card__body staff-stack">
            <div className="staff-row staff-row--between">
              <div>
                <div style={{ fontWeight: 800 }}>Two-factor authentication</div>
                <div className="staff-field__hint">Required for every staff account.</div>
              </div>
              <Badge tone={user?.twoFactorEnabled ? "free" : "warn"} dot>
                {user?.twoFactorEnabled ? "Enabled" : "Not enabled"}
              </Badge>
            </div>
            <p className="staff-field__hint" style={{ margin: 0 }}>
              Contact your administrator to reset your authenticator app.
            </p>
            <div style={{ borderTop: "1.5px solid var(--signova-border)", paddingTop: 16 }}>
              <Button variant="secondary" onClick={() => void signOut()}>
                Sign out of this device
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <CardHeader title="Change password" />
        <div className="staff-card__body">
          <form className="staff-form" onSubmit={handleChangePassword} noValidate style={{ maxWidth: 440 }}>
            {formError ? <ErrorBanner message={formError} /> : null}
            {formSuccess ? (
              <div className="staff-banner" role="status">
                <span aria-hidden="true">✓</span>
                <div className="staff-banner__body">
                  Password changed. You may be signed out of other devices.
                </div>
              </div>
            ) : null}
            <div className="staff-field">
              <label className="staff-field__label" htmlFor="current-password">
                Current password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="current-password"
                  className="staff-input"
                  type={showCurrent ? "text" : "password"}
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent((v) => !v)}
                  aria-label={showCurrent ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)",
                    width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
                    background: "none", border: "none", cursor: "pointer", color: "var(--signova-muted-text, #68636B)",
                    borderRadius: "8px",
                  }}
                >
                  {showCurrent ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <div className="staff-field">
              <label className="staff-field__label" htmlFor="new-password">
                New password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="new-password"
                  className="staff-input"
                  type={showNew ? "text" : "password"}
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowNew((v) => !v)}
                  aria-label={showNew ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)",
                    width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
                    background: "none", border: "none", cursor: "pointer", color: "var(--signova-muted-text, #68636B)",
                    borderRadius: "8px",
                  }}
                >
                  {showNew ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
              <span className="staff-field__hint">At least 10 characters.</span>
            </div>
            <div className="staff-field">
              <label className="staff-field__label" htmlFor="confirm-password">
                Confirm new password
              </label>
              <div style={{ position: "relative" }}>
                <input
                  id="confirm-password"
                  className="staff-input"
                  type={showConfirm ? "text" : "password"}
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  style={{ paddingRight: "44px" }}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  style={{
                    position: "absolute", right: "4px", top: "50%", transform: "translateY(-50%)",
                    width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center",
                    background: "none", border: "none", cursor: "pointer", color: "var(--signova-muted-text, #68636B)",
                    borderRadius: "8px",
                  }}
                >
                  {showConfirm ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>
            <Button type="submit" loading={isSaving}>
              Change password
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
