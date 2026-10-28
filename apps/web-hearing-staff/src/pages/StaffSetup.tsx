import React, { useEffect, useMemo, useState } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { useStaffAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/States";
import { IconEye } from "../components/ui/Icons";
import brandIcon from "../assets/brand/signova-mark-purple.png";

type SetupStage = "password" | "enroll" | "done";

export function StaffSetup() {
  const { loginStage, loginError, isSubmitting, confirmStaffSetup, cancelStaffSetup, startStaffSetup } = useStaffAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

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
    return <Navigate to="/login" replace />;
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
      await startStaffSetup(token!, password);
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
          <form onSubmit={handleEnrollSubmit}>
            <div className="admin-setup__field">
              <label className="admin-label" htmlFor="staff-enroll-code">
                Authentication code
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
              <Button variant="ghost" block onClick={cancelStaffSetup}>
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
          </div>
        </form>
      </div>
    </div>
  );
}
