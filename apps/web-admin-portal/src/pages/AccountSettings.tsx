import { useState, type FormEvent } from "react";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi, ApiError } from "../services/api";
import {
  PageHeading,
  PageBody,
  Card,
  CardHeader,
  CardContent,
  CardFooter,
  Button,
  Input,
  FormGroup,
  Alert,
  Badge,
  ConfirmDialog,
  UserIcon,
  KeyIcon,
  ShieldIcon,
  LogoutIcon,
} from "../components/ui";

export function AccountSettings() {
  const { user, signOut } = useAdminAuth();

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  // Sign out confirmation dialog
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
    setPasswordError(null);
    setPasswordSuccess(null);

    if (newPassword.length < 10) {
      setPasswordError("New password must be at least 10 characters in length.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation do not match.");
      return;
    }

    setPasswordLoading(true);
    try {
      const res = await adminApi.changePassword(currentPassword, newPassword);
      setPasswordSuccess(res.message ?? "Password updated successfully. Please sign in again.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setTimeout(() => {
        signOut();
      }, 2500);
    } catch (err: any) {
      setPasswordError(err?.message ?? "Password change failed. Verify your current password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <PageBody>
      <PageHeading
        eyebrow="Security &amp; Credentials"
        title="Administrator Account"
        description="Profile details, password security, and active session management."
      />

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Administrator Profile Card */}
        <Card>
          <CardHeader
            title="Administrator Identity"
            subtitle="Your account permissions and organizational scope"
          />
          <CardContent>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Full Name
                </span>
                <p style={{ fontSize: "15px", fontWeight: "700", color: "var(--admin-text)", marginTop: "4px" }}>
                  {user?.name ?? "Administrator"}
                </p>
              </div>

              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Email Address
                </span>
                <p style={{ fontSize: "14px", fontFamily: "var(--admin-font-mono)", color: "var(--admin-text)", marginTop: "4px" }}>
                  {user?.email ?? "—"}
                </p>
              </div>

              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Access Role
                </span>
                <div style={{ marginTop: "4px" }}>
                  <Badge variant="purple" label="System Administrator" />
                </div>
              </div>

              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--admin-text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Two-Factor Authentication
                </span>
                <div style={{ marginTop: "4px" }}>
                  <Badge
                    variant={user?.twoFactorEnabled ? "success" : "warning"}
                    label={user?.twoFactorEnabled ? "Enforced & Active" : "Pending Setup"}
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Change Password Card */}
        <Card>
          <CardHeader
            title="Change Account Password"
            subtitle="Update your administrator credentials (minimum 10 characters required)"
          />
          <CardContent>
            <form onSubmit={handleChangePassword} style={{ maxWidth: "520px" }}>
              {passwordError && (
                <Alert variant="danger" onClose={() => setPasswordError(null)}>
                  {passwordError}
                </Alert>
              )}

              {passwordSuccess && (
                <Alert variant="success" onClose={() => setPasswordSuccess(null)}>
                  {passwordSuccess}
                </Alert>
              )}

              <FormGroup label="Current Password">
                <Input
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="New Password" hint="Must be at least 10 characters in length">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </FormGroup>

              <FormGroup label="Confirm New Password">
                <Input
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </FormGroup>

              <div style={{ marginTop: "18px" }}>
                <Button
                  type="submit"
                  variant="primary"
                  loading={passwordLoading}
                  disabled={!currentPassword || !newPassword || !confirmPassword || passwordLoading}
                >
                  Update Password
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* Two-Factor Authentication Info Card */}
        <Card>
          <CardHeader
            title="Multi-Factor Security Policy"
            subtitle="Institutional TOTP authenticator protection"
          />
          <CardContent>
            <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
              <div
                style={{
                  width: "38px",
                  height: "38px",
                  borderRadius: "var(--admin-radius-md)",
                  background: "var(--admin-teal-soft)",
                  color: "var(--admin-teal)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <ShieldIcon className="w-5 h-5" />
              </div>
              <div style={{ fontSize: "13.5px", color: "var(--admin-text-secondary)", lineHeight: "1.5" }}>
                <p style={{ fontWeight: "700", color: "var(--admin-text)", marginBottom: "4px" }}>
                  Mandatory Two-Factor Authentication Enforced
                </p>
                <p>
                  In compliance with institutional security standards, all administrative sessions require hardware or
                  authenticator app-backed TOTP verification on sign-in. If you need to reconfigure your authenticator
                  device, request a 2FA reset from a fellow administrator or system maintenance script.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Session Termination Card */}
        <Card>
          <CardHeader
            title="Active Session Governance"
            subtitle="Sign out from this administrative workstation"
          />
          <CardContent>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: "14px", fontWeight: "700", color: "var(--admin-text)" }}>
                  End Administrative Session
                </p>
                <p style={{ fontSize: "12.5px", color: "var(--admin-text-secondary)" }}>
                  Revokes the current JWT refresh token and clears all workstation storage.
                </p>
              </div>

              <Button
                variant="danger"
                icon={<LogoutIcon className="w-4 h-4" />}
                onClick={() => setShowSignOutConfirm(true)}
              >
                Sign Out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <ConfirmDialog
        isOpen={showSignOutConfirm}
        onClose={() => setShowSignOutConfirm(false)}
        onConfirm={() => {
          setShowSignOutConfirm(false);
          void signOut();
        }}
        title="Confirm Sign Out"
        message="Are you sure you want to log out of the Signova administrative console?"
        confirmText="Sign Out"
        confirmVariant="danger"
      />
    </PageBody>
  );
}
