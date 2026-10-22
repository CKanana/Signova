import React, { useEffect, useState } from "react";
import { AuthLayout } from "../../../../shared/web-login/src/AuthLayout";
import { useAdminAuth } from "../context/AdminAuthContext";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/States";
import { IconEye, IconMessage, IconShield } from "../components/ui/Icons";
import brandIcon from "/signova-mark-purple.png";
import "../../../../shared/web-login/src/auth-layout.css";

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function Login() {
  const {
    twoFactorStage,
    error,
    isSubmitting,
    signIn,
    verifyTwoFactor,
    activateEnrollment,
    cancelTwoFactor,
  } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  const showCredentials = twoFactorStage.kind === "none";
  const showTwoFactor = twoFactorStage?.kind === "verify";
  const showEnroll = twoFactorStage?.kind === "enroll";

  useEffect(() => {
    setLocalError(null);
    setCode("");
    setPasswordVisible(false);
  }, [twoFactorStage.kind]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!isEmail(email)) {
      setLocalError("Enter your work email address.");
      return;
    }
    if (password.length < 8) {
      setLocalError("Passwords are at least 8 characters.");
      return;
    }
    await signIn(email.trim(), password);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!/^\d{6}$/.test(code)) {
      setLocalError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    await verifyTwoFactor(code);
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (twoFactorStage.kind !== "enroll" || !twoFactorStage.challengeToken) {
      setLocalError("Missing enrollment session. Try again.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setLocalError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    await activateEnrollment(twoFactorStage.challengeToken, code);
  }

  const errorMessage = localError ?? error;

  return (
    <AuthLayout
      eyebrow="SIGN LANGUAGE. REAL CONNECTION."
      title="Your organisation, under your control."
      subtitle="Manage your tellers, service counters and activity from one secure workspace."
      logo={<img src={brandIcon} alt="" className="staff-login__logo" />}
      illustration={
        <>
          <IconMessage size={68} className="staff-login__bubble staff-login__bubble--first" />
          <img src={brandIcon} alt="" />
          <IconMessage size={48} className="staff-login__bubble staff-login__bubble--second" />
        </>
      }
      footer={
        <>
          <IconShield size={18} />
          <span>Protected with two-factor authentication</span>
        </>
      }
      rightPanel={
        <div>
          {showCredentials ? (
            <form className="staff-form" onSubmit={handleSignIn} noValidate>
              <div>
                <div className="staff-eyebrow">ADMINISTRATOR SIGN IN</div>
                <h1 className="staff-login__title">Admin sign in</h1>
                <p className="staff-login__subtitle">Sign in to your Signova administration workspace.</p>
              </div>
              {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="admin-email">
                  Admin email
                </label>
                <input
                  id="admin-email"
                  className="staff-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="admin-password">
                  Password
                </label>
                <div className="staff-login__password">
                  <input
                    id="admin-password"
                    className="staff-input"
                    type={passwordVisible ? "text" : "password"}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="staff-login__visibility"
                    aria-label={passwordVisible ? "Hide password" : "Show password"}
                    aria-pressed={passwordVisible}
                    aria-controls="admin-password"
                    title={passwordVisible ? "Hide password" : "Show password"}
                    onClick={() => setPasswordVisible(!passwordVisible)}
                  >
                    <IconEye concealed={passwordVisible} />
                  </button>
                </div>
              </div>
              <Button type="submit" block loading={isSubmitting}>
                {isSubmitting ? "Signing in..." : <>Continue <span aria-hidden="true">&rarr;</span></>}
              </Button>
              <p className="staff-login__switch">
                <button type="button" className="staff-login__link" onClick={() => {}}>
                  Forgot password?
                </button>
                <button type="button" className="staff-login__link" onClick={() => window.location.assign("/login")}>
                  Teller? Sign in here
                </button>
              </p>
            </form>
          ) : null}

          {showTwoFactor ? (
            <form className="staff-form" onSubmit={handleVerify} noValidate>
              <div>
                <div className="staff-eyebrow">Two-factor authentication</div>
                <h1 className="staff-login__title">Enter your code</h1>
                <p className="staff-login__subtitle">Open your authenticator app and enter the 6-digit code.</p>
              </div>
              {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="admin-otp">
                  Authentication code
                </label>
                <input
                  id="admin-otp"
                  className="staff-input staff-input--code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                  required
                />
              </div>
              <Button type="submit" block loading={isSubmitting}>
                Verify and sign in
              </Button>
              <Button variant="ghost" block onClick={() => cancelTwoFactor?.()}>
                Start over
              </Button>
            </form>
          ) : null}

          {showEnroll ? (
            <form className="staff-form" onSubmit={handleEnroll} noValidate>
              <div>
                <div className="staff-eyebrow">First-time setup</div>
                <h1 className="staff-login__title">Set up two-factor authentication</h1>
                <p className="staff-login__subtitle">Your admin account requires 2FA before you can access the administration workspace.</p>
              </div>
              {errorMessage ? <ErrorBanner message={errorMessage} /> : null}
              <Button type="submit" block loading={isSubmitting}>
                Get setup code
              </Button>
              <Button variant="ghost" block onClick={() => cancelTwoFactor?.()}>
                Start over
              </Button>
            </form>
          ) : null}
        </div>
      }
    />
  );
}
