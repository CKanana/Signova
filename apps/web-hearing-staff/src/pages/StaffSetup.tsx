import React, { useEffect, useMemo, useState } from "react";
import { useStaffAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/States";
import { IconEye } from "../components/ui/Icons";
import brandIcon from "../assets/brand/signova-mark-purple.png";

type SetupStage = "password" | "enroll" | "done";

interface StaffSetupProps {
  token?: string | null;
  onCancel?: () => void;
}

export function StaffSetup({ token: propToken, onCancel }: StaffSetupProps) {
  const { loginStage, loginError, isSubmitting, enrollment, confirmStaffSetup, cancelStaffSetup, startStaffSetup } = useStaffAuth();
  
  const token = useMemo(() => {
    if (propToken) return propToken;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return p.get("token") || "";
    }
    return "";
  }, [propToken]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [stage, setStage] = useState<SetupStage>("password");
  const [passwordVisible, setPasswordVisible] = useState(false);

  useEffect(() => {
    if (!token) return;
    setLocalError(null);
    setPassword("");
    setConfirm("");
    setPasswordVisible(false);
  }, [token]);

  const challengeToken = useMemo(() => {
    if (loginStage?.kind === "staff-setup" && loginStage.challengeToken) {
      return loginStage.challengeToken;
    }
    return null;
  }, [loginStage]);

  useEffect(() => {
    if (loginStage?.kind === "staff-setup" && challengeToken) {
      setStage("enroll");
    }
  }, [loginStage, challengeToken]);

  if (!token) {
    return (
      <div className="admin-setup">
        <div className="admin-setup__card">
          <div className="admin-setup__header">
            <img src={brandIcon} alt="Signova" />
            <h1 className="admin-setup__title">Invalid Invitation Link</h1>
            <p className="admin-setup__subtitle">
              This setup link is missing or invalid. Please check the link from your invitation email or contact your administrator.
            </p>
          </div>
          <div className="admin-setup__actions">
            <Button
              variant="primary"
              block
              onClick={() => {
                if (onCancel) onCancel();
                else window.location.href = "/";
              }}
            >
              Back to Sign In
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const errorMessage = localError ?? loginError;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 12) {
      setLocalError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setLocalError("The passwords do not match.");
      return;
    }
    try {
      await startStaffSetup(token, password);
    } catch (err: any) {
      setLocalError(err?.message ?? "Setup failed. Use the link from your email.");
    }
  }

  async function handleEnrollSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!challengeToken) return;
    try {
      await confirmStaffSetup(code);
    } catch (err: any) {
      setLocalError(err?.message ?? "Failed to activate two-factor authentication. Please check your code.");
    }
  }

  function handleCancel() {
    cancelStaffSetup();
    if (onCancel) {
      onCancel();
    } else {
      window.location.href = "/";
    }
  }

  if (stage === "enroll") {
    return (
      <div className="admin-setup">
        <div className="admin-setup__card">
          <div className="admin-setup__header">
            <img src={brandIcon} alt="" />
            <h1 className="admin-setup__title">Set up two-factor authentication</h1>
            <p className="admin-setup__subtitle">Scan the QR code with your authenticator app and enter the 6-digit code.</p>
          </div>
          {errorMessage ? <ErrorBanner message={errorMessage} /> : null}

          {enrollment?.qrDataUrl ? (
            <div className="admin-setup__field" style={{ textAlign: "center", marginBottom: "16px" }}>
              <span className="admin-label" style={{ display: "block", marginBottom: "8px" }}>
                1. Scan this QR code in your authenticator app
              </span>
              <img
                src={enrollment.qrDataUrl}
                alt="Two-factor QR code"
                style={{
                  display: "block",
                  margin: "0 auto 8px",
                  borderRadius: "12px",
                  border: "1px solid #efe9d2",
                  padding: "8px",
                  background: "#ffffff",
                }}
                width={180}
                height={180}
              />
              <p style={{ fontSize: "12px", color: "#68636b", margin: "4px 0" }}>
                Manual key: <code style={{ fontWeight: "bold", background: "#f5f5f5", padding: "2px 6px", borderRadius: "4px" }}>{enrollment.secret}</code>
              </p>
            </div>
          ) : null}

          <form onSubmit={handleEnrollSubmit}>
            <div className="admin-setup__field">
              <label className="admin-label" htmlFor="staff-enroll-code">
                {enrollment?.qrDataUrl ? "2. Enter the 6-digit authentication code" : "Authentication code"}
              </label>
              <input
                id="staff-enroll-code"
                className="admin-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="000000"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                required
              />
            </div>
            <div className="admin-setup__actions">
              <Button type="submit" block loading={isSubmitting}>
                {isSubmitting ? "Activating..." : "Activate and sign in"}
              </Button>
              <Button variant="ghost" block type="button" onClick={handleCancel}>
                Start over
              </Button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-setup">
      <div className="admin-setup__card">
        <div className="admin-setup__header">
          <img src={brandIcon} alt="" />
          <h1 className="admin-setup__title">Staff account setup</h1>
          <p className="admin-setup__subtitle">Create a password for your staff account. You will complete 2FA on the next screen.</p>
        </div>
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        <form onSubmit={handlePasswordSubmit}>
          <div className="admin-setup__field">
            <label className="admin-label" htmlFor="staff-setup-password">
              New password
            </label>
            <div className="admin-setup__password">
              <input
                id="staff-setup-password"
                className="admin-input"
                type={passwordVisible ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="admin-setup__visibility"
                aria-label={passwordVisible ? "Hide password" : "Show password"}
                aria-pressed={passwordVisible}
                aria-controls="staff-setup-password"
                title={passwordVisible ? "Hide password" : "Show password"}
                onClick={() => setPasswordVisible(!passwordVisible)}
              >
                <IconEye concealed={passwordVisible} />
              </button>
            </div>
            <span className="admin-setup__hint">Minimum 12 characters, with uppercase, lowercase, number and special symbol.</span>
          </div>
          <div className="admin-setup__field">
            <label className="admin-label" htmlFor="staff-setup-confirm">
              Confirm password
            </label>
            <input
              id="staff-setup-confirm"
              className="admin-input"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />
          </div>
          <div className="admin-setup__actions">
            <Button type="submit" block loading={isSubmitting}>
              Continue
            </Button>
            <Button variant="ghost" block type="button" onClick={handleCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
