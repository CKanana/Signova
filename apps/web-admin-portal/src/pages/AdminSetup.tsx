import React, { useMemo, useState, useEffect } from "react";
import { useSearchParams, Navigate } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";
import { adminApi } from "../services/api";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/States";
import { IconEye } from "../components/ui/Icons";
import brandIcon from "/signova-mark-purple.png";

type SetupStage = "password" | "enroll" | "done";

export function AdminSetup() {
  const { error, isSubmitting, activateEnrollment, cancelTwoFactor } = useAdminAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [stage, setStage] = useState<SetupStage>("password");
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const errorMessage = localError ?? error;
  const passwordMismatch =
    password.length > 0 &&
    confirm.length > 0 &&
    password !== confirm;

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (password.length < 12) {
      setLocalError("Password must be at least 12 characters.");
      return;
    }
    if (password !== confirm) {
      setLocalError("Passwords do not match.");
      return;
    }
    if (!token) {
      setLocalError("Setup link is missing. Use the link from your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await adminApi.bootstrapAccept(token, password);
      if (res.status === "mfa_enroll_required" && res.challengeToken) {
        await adminApi.enroll2FAStart(res.challengeToken);
        setChallengeToken(res.challengeToken);
        setStage("enroll");
      }
    } catch (err: any) {
      setLocalError(err?.message ?? "Setup failed. Use the link from your email.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleEnrollSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!challengeToken || !code) return;
    setSubmitting(true);
    try {
      await activateEnrollment(challengeToken, code);
      window.location.replace("/login");
    } catch (err: any) {
      setLocalError(err?.message ?? "Failed to activate two-factor authentication. Please check your code.");
    } finally {
      setSubmitting(false);
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
              <label className="admin-label" htmlFor="admin-enroll-code">
                Authentication code
              </label>
              <input
                id="admin-enroll-code"
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
              <Button type="submit" block loading={submitting || isSubmitting}>
                {submitting || isSubmitting ? "Activating..." : "Activate and sign in"}
              </Button>
              <Button variant="ghost" block type="button" onClick={cancelTwoFactor}>
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
          <h1 className="admin-setup__title">Administrator setup</h1>
          <p className="admin-setup__subtitle">Set a password for your administrator account. You will complete 2FA on the next screen.</p>
        </div>
        {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
        <form onSubmit={handlePasswordSubmit}>
          <div className="admin-setup__field">
            <label className="admin-label" htmlFor="admin-setup-password">
              New password
            </label>
            <div className="admin-setup__password">
              <input
                id="admin-setup-password"
                className="admin-input"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className="admin-setup__visibility"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                aria-pressed={showPassword}
                title={showPassword ? "Hide password" : "Show password"}
              >
                <IconEye concealed={!showPassword} />
              </button>
            </div>
            <span className="admin-setup__hint">Minimum 12 characters, with uppercase, lowercase, number and special symbol.</span>
          </div>
          <div className="admin-setup__field">
            <label className="admin-label" htmlFor="admin-setup-confirm">
              Confirm password
            </label>
            <div className="admin-setup__password">
              <input
                id="admin-setup-confirm"
                className="admin-input"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
              />
              <button
                type="button"
                className="admin-setup__visibility"
                onClick={() => setShowConfirm((prev) => !prev)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                aria-pressed={showConfirm}
                title={showConfirm ? "Hide password" : "Show password"}
              >
                <IconEye concealed={!showConfirm} />
              </button>
            </div>
            {passwordMismatch ? (
              <span className="admin-setup__hint" style={{ color: "var(--admin-danger)" }}>
                Passwords do not match.
              </span>
            ) : null}
          </div>
          <div className="admin-setup__actions">
            <Button type="submit" block loading={submitting || isSubmitting} disabled={passwordMismatch}>
              Continue
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
