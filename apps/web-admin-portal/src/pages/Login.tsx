import React, { useEffect, useState } from "react";
import { AuthLayout } from "../../../../shared/web-login/src/AuthLayout";
import { useAdminAuth } from "../context/AdminAuthContext";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/ui/States";
import { IconEye, IconMessage, IconShield } from "../components/ui/Icons";
import brandIcon from "/signova-mark-purple.png";
import { STAFF_APP_URL } from "../config";
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
    loginWithGoogle,
  } = useAdminAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [code, setCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  // Tracks whether the Google Identity Services SDK has fully loaded.
  // The SDK is lazy-loaded via an async/defer script tag, so on the first
  // click `window.google.accounts.id` may not exist yet. We poll until it
  // is ready so the button never errors before the SDK is available.
  const [sdkReady, setSdkReady] = useState(false);

  useEffect(() => {
    // Check immediately: if the SDK is already loaded, no need to pre-load.
    if ((window as any).google?.accounts?.id) {
      setSdkReady(true);
      return;
    }
    // Pre-load Google Identity Services asynchronously so the popup fires
    // promptly when the user clicks the Google button, instead of waiting
    // for a fixed-interval poll to complete. The script is async/defer so
    // the browser does not block rendering while it downloads.
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => setSdkReady(true);
    document.head.appendChild(script);
    // Guard against stale callbacks/leaks: remove the script tag if the SDK
    // never loads, and clear the polling interval if the SDK loads.
    const timeout = setTimeout(() => {
      document.head.removeChild(script);
    }, 5000);
    return () => {
      clearTimeout(timeout);
      document.head.removeChild(script);
    };
  }, []);

  // Pre-initialize Google SDK as soon as it's ready.
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

  const navigate = useNavigate();

  const { isAuthenticated } = useAdminAuth();
  useEffect(() => {
    if (isAuthenticated) {
      navigate("/admin/overview", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const showCredentials = twoFactorStage.kind === "none";
  const showTwoFactor = twoFactorStage?.kind === "verify";
  const showEnroll = twoFactorStage?.kind === "enroll";

  useEffect(() => {
    setLocalError(null);
    setCode("");
    setPasswordVisible(false);
  }, [twoFactorStage.kind]);

  const [pending, setPending] = useState(false);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setLocalError(null);
    if (!isEmail(email)) {
      setPending(false);
      setLocalError("Enter your work email address.");
      return;
    }
    if (password.length < 8) {
      setPending(false);
      setLocalError("Passwords are at least 8 characters.");
      return;
    }
    await signIn(email.trim(), password);
    setPending(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setLocalError(null);
    if (!/^\d{6}$/.test(code)) {
      setPending(false);
      setLocalError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    await verifyTwoFactor(code);
    setPending(false);
  }

  async function handleEnroll(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setPending(true);
    setLocalError(null);
    if (twoFactorStage.kind !== "enroll" || !twoFactorStage.challengeToken) {
      setPending(false);
      setLocalError("Missing enrollment session. Try again.");
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setPending(false);
      setLocalError("Enter the 6-digit code from your authenticator app.");
      return;
    }
    await activateEnrollment(twoFactorStage.challengeToken, code);
    setPending(false);
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
              <Button
                type="button"
                variant="ghost"
                block
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
                        const div = document.getElementById("__gsi_btn_admin");
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
                Continue with Google
              </Button>
              {/* Hidden fallback — only shown if prompt() is suppressed */}
              <div id="__gsi_btn_admin" style={{ display: "none", justifyContent: "center", marginTop: 4 }} />
              <p className="staff-login__switch">
                <button type="button" className="staff-login__link" onClick={() => {}}>
                  Forgot password?
                </button>
                <a
                  href={`${STAFF_APP_URL}/login`}
                  className="staff-login__link"
                  style={{ background: "none", border: "none", cursor: "pointer" }}
                >
                  Teller? Sign in here
                </a>
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
