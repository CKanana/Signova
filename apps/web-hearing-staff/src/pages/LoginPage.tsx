import React, { useCallback, useEffect, useState } from "react";
import { useStaffAuth } from "../context/AuthContext";
import { api } from "../services/api";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/States";
import { IconEye, IconMessage, IconShield } from "../components/ui/Icons";
import brandIcon from "../assets/brand/signova-mark-purple.png";
import "../styles/login.css";

/**
 * Staff sign-in: email + password → TOTP 2FA → dashboard.
 *
 * The three possible backend outcomes of POST /api/auth/login are handled
 * exactly as the server defines them:
 *   2fa_required        → 6-digit code step
 *   mfa_enroll_required → mandatory first-time enrollment (QR + confirm)
 *   authenticated       → (never for staff accounts, but handled anyway)
 *
 * 2FA is never optional or bypassed — without a verified code there is no
 * access token, and without an access token the backend serves nothing.
 */

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginScreen() {
  const {
    loginStage,
    loginError,
    isSubmitting,
    enrollment,
    signIn,
    verifyCode,
    beginEnrollment,
    confirmEnrollment,
    cancelLogin,
    showRegister,
    register,
    showForgot,
    requestReset,
    confirmReset,
    openResetFromUrl,
  } = useStaffAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [organizationId, setOrganizationId] = useState("");
  const [organizations, setOrganizations] = useState<Array<{ _id: string; name: string }>>([]);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [signupPasswordVisible, setSignupPasswordVisible] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [confirmPasswordVisible, setConfirmPasswordVisible] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetVisible, setResetVisible] = useState(false);
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // If the URL carries ?token= (a reset link), open the reset form directly.
  // The token is read once and kept only in component state — never stored
  // in localStorage/sessionStorage or logged.
  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) openResetFromUrl(token);
  }, [openResetFromUrl]);

  // Load the public organization list once, for the sign-up dropdown.
  const loadOrganizations = useCallback(async () => {
    try {
      const { organizations: list } = await api.listPublicOrganizations();
      setOrganizations(list);
    } catch {
      // The dropdown degrades gracefully; submitting still surfaces the error.
      setOrganizations([]);
    }
  }, []);

  const showCredentials = loginStage === null || loginStage.kind === "credentials";
  const showTwoFactor = loginStage?.kind === "twoFactor";
  const showEnroll = loginStage?.kind === "enroll";
  const showSignup = loginStage?.kind === "register";
  const showForgotScreen = loginStage?.kind === "forgot";
  const showResetScreen = loginStage?.kind === "reset";
  const resetSent = loginStage?.kind === "reset" && loginStage.token === "__sent__";

  useEffect(() => {
    if (showSignup) void loadOrganizations();
  }, [showSignup, loadOrganizations]);

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
    await verifyCode(code);
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!enrollment) {
      await beginEnrollment();
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setLocalError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    await confirmEnrollment(code);
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (!isEmail(email)) {
      setLocalError("Enter a valid email address.");
      return;
    }
    await requestReset(email);
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (resetPassword.length < 10) {
      setLocalError("Choose a password of at least 10 characters.");
      return;
    }
    if (resetPassword !== resetConfirm) {
      setLocalError("The passwords do not match.");
      return;
    }
    await confirmReset(resetPassword);
    // On success the context returns to the credentials stage; clear fields.
    setResetPassword("");
    setResetConfirm("");
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    if (name.trim().length < 2) {
      setLocalError("Enter your full name.");
      return;
    }
    if (!organizationId) {
      setLocalError("Select your organization.");
      return;
    }
    if (!isEmail(email)) {
      setLocalError("Enter a valid email address.");
      return;
    }
    if (password.length < 10) {
      setLocalError("Choose a password of at least 10 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setLocalError("The passwords do not match.");
      return;
    }
    await register(name.trim(), organizationId, email.trim(), password);
  }

  const error = localError ?? loginError;

  return (
    <main className="staff-login">
      <section className="staff-login__brand">
        <header className="staff-login__brandmark">
          <img src={brandIcon} alt="" className="staff-login__logo" />
          <span className="staff-login__wordmark">Signova</span>
        </header>
        <div className="staff-login__intro">
          <p className="staff-login__tagline">Sign Language. Real Connection.</p>
          <h2 className="staff-login__headline">
            Communication that brings people closer.
          </h2>
          <p className="staff-login__copy">
            Receive requests from Deaf visitors, review translated messages, and respond in real time.
          </p>
        </div>
        <div className="staff-login__illustration" aria-hidden="true">
          <IconMessage size={68} className="staff-login__bubble staff-login__bubble--first" />
          <img src={brandIcon} alt="" />
          <IconMessage size={48} className="staff-login__bubble staff-login__bubble--second" />
        </div>
        <p className="staff-login__security">
          <IconShield size={18} />
          <span>Protected with two-factor authentication</span>
        </p>
      </section>

      <section className="staff-login__panel">
        <div className="staff-login__card">
          {showCredentials ? (
            <form className="staff-form" onSubmit={handleSignIn} noValidate>
              <div>
                <div className="staff-eyebrow">Staff sign in</div>
                <h1 className="staff-login__title">
                  Welcome back
                </h1>
                <p className="staff-login__subtitle">Sign in to your Signova workspace.</p>
              </div>
              {error ? <ErrorBanner message={error} /> : null}
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-email">
                  Work email
                </label>
                <input
                  id="staff-email"
                  className="staff-input"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-password">
                  Password
                </label>
                <div className="staff-login__password">
                  <input
                    id="staff-password"
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
                    aria-controls="staff-password"
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
                <button type="button" className="staff-login__link" onClick={showForgot}>
                  Forgot password?
                </button>
              </p>
              <p className="staff-login__switch">
                Don&apos;t have an account?{" "}
                <button type="button" className="staff-login__link" onClick={showRegister}>
                  Create a staff account
                </button>
              </p>
            </form>
          ) : null}

          {showForgotScreen ? (
            <form className="staff-form" onSubmit={handleForgot} noValidate>
              <div>
                <div className="staff-eyebrow">Password recovery</div>
                <h1 className="staff-login__title">
                  Reset your password
                </h1>
                <p className="staff-login__subtitle">
                  Enter your staff email and we&apos;ll send you a reset link.
                </p>
              </div>
              {error ? <ErrorBanner message={error} /> : null}
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-forgot-email">
                  Email
                </label>
                <input
                  id="staff-forgot-email"
                  className="staff-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" block loading={isSubmitting}>
                Send reset link
              </Button>
              <Button variant="ghost" block onClick={cancelLogin}>
                Back to sign in
              </Button>
            </form>
          ) : null}

          {showResetScreen ? (
            resetSent ? (
              <div className="staff-form">
                <div>
                  <div className="staff-eyebrow">Check your email</div>
                  <h1 className="staff-login__title">
                    Reset link sent
                  </h1>
                  <p className="staff-login__subtitle">
                    If an eligible account exists for that email address, password-reset
                    instructions will be sent. The link expires in 15 minutes.
                  </p>
                </div>
                <Button variant="ghost" block onClick={cancelLogin}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form className="staff-form" onSubmit={handleReset} noValidate>
                <div>
                  <div className="staff-eyebrow">Set a new password</div>
                  <h1 className="staff-login__title">
                    Choose a new password
                  </h1>
                  <p className="staff-login__subtitle">
                    Enter a new password for your Signova staff account.
                  </p>
                </div>
                {error ? <ErrorBanner message={error} /> : null}
                <div className="staff-field">
                  <label className="staff-field__label" htmlFor="staff-reset-password">
                    New password
                  </label>
                  <div className="staff-login__password">
                    <input
                      id="staff-reset-password"
                      className="staff-input"
                      type={resetVisible ? "text" : "password"}
                      autoComplete="new-password"
                      value={resetPassword}
                      onChange={(e) => setResetPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      className="staff-login__visibility"
                      aria-label={resetVisible ? "Hide password" : "Show password"}
                      aria-pressed={resetVisible}
                      aria-controls="staff-reset-password"
                      onClick={() => setResetVisible(!resetVisible)}
                    >
                      <IconEye concealed={resetVisible} />
                    </button>
                  </div>
                  <span className="staff-field__hint">At least 10 characters.</span>
                </div>
                <div className="staff-field">
                  <label className="staff-field__label" htmlFor="staff-reset-confirm">
                    Confirm new password
                  </label>
                  <input
                    id="staff-reset-confirm"
                    className="staff-input"
                    type={resetVisible ? "text" : "password"}
                    autoComplete="new-password"
                    value={resetConfirm}
                    onChange={(e) => setResetConfirm(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" block loading={isSubmitting}>
                  Reset password
                </Button>
                <Button variant="ghost" block onClick={cancelLogin}>
                  Back to sign in
                </Button>
              </form>
            )
          ) : null}

          {showSignup ? (
            <form className="staff-form" onSubmit={handleRegister} noValidate>
              <div>
                <div className="staff-eyebrow">Create account</div>
                <h1 className="staff-login__title">
                  Join your organization
                </h1>
                <p className="staff-login__subtitle">
                  Create a staff account. You&apos;ll set up two-factor authentication on the next step.
                </p>
              </div>
              {error ? <ErrorBanner message={error} /> : null}
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-name">
                  Full name
                </label>
                <input
                  id="staff-name"
                  className="staff-input"
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-organization">
                  Organization
                </label>
                <select
                  id="staff-organization"
                  className="staff-input staff-select"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                  required
                >
                  <option value="" disabled>
                    {organizations.length === 0 ? "Loading organizations…" : "Select your organization"}
                  </option>
                  {organizations.map((org) => (
                    <option key={org._id} value={org._id}>
                      {org.name}
                    </option>
                  ))}
                </select>
                <span className="staff-field__hint">
                  Your organization is chosen from the list — you cannot create a new one.
                </span>
              </div>
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-signup-email">
                  Email
                </label>
                <input
                  id="staff-signup-email"
                  className="staff-input"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <span className="staff-field__hint">
                  Use a gmail.com address — other email domains are not accepted.
                </span>
              </div>
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-signup-password">
                  Password
                </label>
                <div className="staff-login__password">
                  <input
                    id="staff-signup-password"
                    className="staff-input"
                    type={signupPasswordVisible ? "text" : "password"}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="staff-login__visibility"
                    aria-label={signupPasswordVisible ? "Hide password" : "Show password"}
                    aria-pressed={signupPasswordVisible}
                    aria-controls="staff-signup-password"
                    title={signupPasswordVisible ? "Hide password" : "Show password"}
                    onClick={() => setSignupPasswordVisible(!signupPasswordVisible)}
                  >
                    <IconEye concealed={signupPasswordVisible} />
                  </button>
                </div>
                <span className="staff-field__hint">At least 10 characters.</span>
              </div>
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-confirm-password">
                  Confirm password
                </label>
                <div className="staff-login__password">
                  <input
                    id="staff-confirm-password"
                    className="staff-input"
                    type={confirmPasswordVisible ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    className="staff-login__visibility"
                    aria-label={confirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                    aria-pressed={confirmPasswordVisible}
                    aria-controls="staff-confirm-password"
                    title={confirmPasswordVisible ? "Hide confirm password" : "Show confirm password"}
                    onClick={() => setConfirmPasswordVisible(!confirmPasswordVisible)}
                  >
                    <IconEye concealed={confirmPasswordVisible} />
                  </button>
                </div>
              </div>
              <Button type="submit" block loading={isSubmitting}>
                Create account
              </Button>
              <Button variant="ghost" block onClick={cancelLogin}>
                Back to sign in
              </Button>
            </form>
          ) : null}

          {showTwoFactor ? (
            <form className="staff-form" onSubmit={handleVerify} noValidate>
              <div>
                <div className="staff-eyebrow">Two-factor authentication</div>
                <h1 className="staff-login__title">
                  Enter your code
                </h1>
                <p className="staff-login__subtitle">
                  Open your authenticator app and enter the 6-digit code.
                </p>
              </div>
              {error ? <ErrorBanner message={error} /> : null}
              <div className="staff-field">
                <label className="staff-field__label" htmlFor="staff-otp">
                  Authentication code
                </label>
                <input
                  id="staff-otp"
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
              <Button variant="ghost" block onClick={cancelLogin}>
                Start over
              </Button>
            </form>
          ) : null}

          {showEnroll ? (
            <form className="staff-form" onSubmit={handleEnroll} noValidate>
              <div>
                <div className="staff-eyebrow">First-time setup</div>
                <h1 className="staff-login__title">
                  Set up two-factor authentication
                </h1>
                <p className="staff-login__subtitle">
                  Your account requires 2FA before you can access the staff dashboard.
                </p>
              </div>
              {error ? <ErrorBanner message={error} /> : null}

              {!enrollment ? (
                <Button type="submit" block loading={isSubmitting}>
                  Get setup code
                </Button>
              ) : (
                <>
                  <div className="staff-field">
                    <span className="staff-field__label">1. Scan this QR code</span>
                    <img
                      src={enrollment.qrDataUrl}
                      alt="Two-factor setup QR code"
                      width={200}
                      height={200}
                      className="staff-login__qr"
                    />
                    <span className="staff-field__hint">
                      Or enter this key manually: <strong>{enrollment.secret}</strong>
                    </span>
                  </div>
                  <div className="staff-field">
                    <label className="staff-field__label" htmlFor="staff-enroll-code">
                      2. Enter the 6-digit code
                    </label>
                    <input
                      id="staff-enroll-code"
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
                    Activate and sign in
                  </Button>
                </>
              )}
              <Button variant="ghost" block onClick={cancelLogin}>
                Start over
              </Button>
            </form>
          ) : null}
        </div>
      </section>
    </main>
  );
}
