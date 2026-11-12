import React, { useEffect, useState } from "react";
import { AuthLayout } from "../../../../shared/web-login/src/AuthLayout";
import { useStaffAuth } from "../context/AuthContext";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/States";
import { IconEye, IconMessage, IconShield } from "../components/ui/Icons";
import brandIcon from "../assets/brand/signova-mark-purple.png";
import "../../../../shared/web-login/src/auth-layout.css";

function isEmail(value: string) {
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
    showForgot,
    requestReset,
    confirmReset,
    openResetFromUrl,
    resendReset,
    loginWithGoogle,
  } = useStaffAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetConfirm, setResetConfirm] = useState("");
  const [resetVisible, setResetVisible] = useState(false);
  const [code, setCode] = useState("");
  // --- SDK readiness (lazy-loaded Google Identity Services) ---
  const [sdkReady, setSdkReady] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    // Check immediately
    if ((window as any).google?.accounts?.id) {
      setSdkReady(true);
      return;
    }
    // Pre-load Google Identity Services if not yet loaded, so the popup
    // fires promptly when the user clicks the Google button.
    if (!(window as any).google?.accounts?.id) {
      const script = document.createElement("script");
      script.src = "https://accounts.google.com/gsi/client";
      script.async = true;
      script.defer = true;
      script.onload = () => setSdkReady(true);
      document.head.appendChild(script);
      // Guard against memory leaks: clean up the script tag if the SDK
      // never loads within a few seconds.
      const timeout = setTimeout(() => {
        if (!(window as any).google?.accounts?.id) {
          document.head.removeChild(script);
        }
      }, 5000);
      return () => {
        clearTimeout(timeout);
        document.head.removeChild(script);
      };
    }
  }, []);

  // Pre-initialize Google SDK as soon as it's ready — so the popup fires
  // instantly when the button is clicked rather than initializing on demand.
  useEffect(() => {
    if (!sdkReady) return;
    try {
      const g = (window as any).google;
      g.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (response: { credential: string }) => {
          if (response?.credential) {
            await loginWithGoogle(response.credential);
          }
        },
        ux_mode: "popup",
        cancel_on_tap_outside: true,
      });
    } catch {
      /* SDK not ready yet — will re-initialize on click */
    }
  }, [sdkReady, loginWithGoogle]);

  useEffect(() => {
    const token = new URLSearchParams(window.location.search).get("token");
    if (token) openResetFromUrl(token);
  }, [openResetFromUrl]);

  const showCredentials =
    loginStage === null || loginStage.kind === "credentials";
  const showTwoFactor = loginStage?.kind === "twoFactor";
  const showEnroll = loginStage?.kind === "enroll";
  const showPendingApproval = loginStage?.kind === "pending_approval";
  const showForgotScreen = loginStage?.kind === "forgot";
  const showResetScreen = loginStage?.kind === "reset";
  const resetSent = loginStage?.kind === "reset" && loginStage.token === "__sent__";

  function handleCancelLogin() {
    try {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname === "/reset-password"
          ? "/"
          : window.location.pathname
      );
    } catch {
      /* ignore */
    }
    cancelLogin();
  }

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
    try {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname === "/reset-password"
          ? "/"
          : window.location.pathname
      );
    } catch {
      /* ignore */
    }
    setResetPassword("");
    setResetConfirm("");
  }

  const error = localError ?? loginError;

  return (
    <AuthLayout
      eyebrow="Sign Language. Real Connection."
      title="Communication that brings people closer."
      subtitle="Receive requests from Deaf visitors, review translated messages, and respond in real time."
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
                <div className="staff-eyebrow">Staff sign in</div>
                <h1 className="staff-login__title">Welcome back</h1>
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
              <Button
                type="button"
                variant="ghost"
                block
                disabled={isSubmitting}
                onClick={async (e) => {
                  e.preventDefault();
                  setLocalError(null);

                  if (!sdkReady) {
                    setLocalError("Google Sign-In is still loading. Please wait a moment and try again.");
                    return;
                  }

                  try {
                    const g = (window as any).google;
                    if (!g?.accounts?.id) {
                      setLocalError("Google Sign-In could not be loaded. Check your connection and refresh.");
                      return;
                    }

                    // SDK was pre-initialized on mount — just trigger the prompt.
                    g.accounts.id.prompt((notification: any) => {
                      if (notification?.isNotDisplayed?.()) {
                        const div = document.getElementById("__gsi_btn_staff");
                        if (div) {
                          div.style.display = "flex";
                          g.accounts.id.renderButton(div, { type: "standard", theme: "outline", size: "large", width: 300 });
                        }
                        setLocalError("Google Sign-In popup was blocked — click the Google button that appeared below.");
                      } else if (notification?.isSkippedMoment?.()) {
                        setLocalError("Google Sign-In was dismissed. Please try again.");
                      }
                    });
                  } catch {
                    setLocalError("Google Sign-In failed. Please try again or sign in with email and password.");
                  }
                }}
              >
                <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M22.56 12.25c0-.85-.07-1.67-.2-2.47H12v4.62h6.05c-.26 1.37-1.04 2.53-2.23 3.31v2.77h3.57c1.74-1.83 2.69-4.42 2.69-7.53z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.81C3.44 20.73 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.1c-.48-1.37-.76-2.81-.76-4.28s.28-2.91.76-4.28V6.32H2.18C1.43 8.25 1 10.16 1 12.39s.43 4.14 1.18 5.62l3.66-2.81z" fill="#FBBC04" />
                  <path d="M12 5.38c1.32 0 2.54.4 3.59 1.17l2.93-2.93C17.97 2.14 15.48 1 12 1 7.7 1 3.44 3.27 2.18 6.32l3.66 2.81C7.62 5.85 9.7 5.38 12 5.38z" fill="#EA4335" />
                </svg>
                {!sdkReady ? "Loading Google Sign-In…" : "Continue with Google"}
              </Button>
              {/* Hidden fallback — only shown if prompt() is blocked */}
              <div id="__gsi_btn_staff" style={{ display: "none", justifyContent: "center", marginTop: 4 }} />
              <p className="staff-login__switch">
                <button type="button" className="staff-login__link" onClick={showForgot}>
                  Forgot password?
                </button>
              </p>
            </form>
          ) : null}

          {showForgotScreen ? (
            <form className="staff-form" onSubmit={handleForgot} noValidate>
              <div>
                <div className="staff-eyebrow">Password recovery</div>
                <h1 className="staff-login__title">Reset your password</h1>
                <p className="staff-login__subtitle">Enter your staff email and we'll send you a reset link.</p>
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
              <button
                type="button"
                className="staff-login__link"
                onClick={async () => {
                  setLocalError(null);
                  await resendReset(email.trim());
                }}
              >
                Resend link
              </button>
            </form>
          ) : null}

          {showResetScreen ? (
            resetSent ? (
              <div className="staff-form">
                <div>
                  <div className="staff-eyebrow">Check your email</div>
                  <h1 className="staff-login__title">Reset link sent</h1>
                  <p className="staff-login__subtitle">
                    If an eligible account exists for that email address, password-reset
                    instructions will be sent. The link expires in 15 minutes.
                  </p>
                </div>
                <Button variant="ghost" block onClick={handleCancelLogin}>
                  Back to sign in
                </Button>
              </div>
            ) : (
              <form className="staff-form" onSubmit={handleReset} noValidate>
                <div>
                  <div className="staff-eyebrow">Set a new password</div>
                  <h1 className="staff-login__title">Choose a new password</h1>
                  <p className="staff-login__subtitle">Enter a new password for your Signova staff account.</p>
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
                <Button variant="ghost" block onClick={handleCancelLogin}>
                  Back to sign in
                </Button>
              </form>
            )
          ) : null}

          {showPendingApproval ? (
            <div className="staff-form">
              <div>
                <div className="staff-eyebrow">Registration received</div>
                <h1 className="staff-login__title">Pending approval</h1>
                <p className="staff-login__subtitle">
                  Your staff account has been created. An administrator must approve your account before you can sign in and set up two-factor authentication.
                </p>
              </div>
              <Button variant="ghost" block onClick={handleCancelLogin}>
                Back to sign in
              </Button>
            </div>
          ) : null}

          {showTwoFactor ? (
            <form className="staff-form" onSubmit={handleVerify} noValidate>
              <div>
                <div className="staff-eyebrow">Two-factor authentication</div>
                <h1 className="staff-login__title">Enter your code</h1>
                <p className="staff-login__subtitle">Open your authenticator app and enter the 6-digit code.</p>
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
                <h1 className="staff-login__title">Set up two-factor authentication</h1>
                <p className="staff-login__subtitle">Your account requires 2FA before you can access the staff dashboard.</p>
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
      }
    />
  );
}
