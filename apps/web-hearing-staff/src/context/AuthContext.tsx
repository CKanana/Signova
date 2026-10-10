import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, ApiError, bindAuthAccessors, type StaffUser } from "../services/api";
import { disconnectStaffSocket } from "../services/socket";

/**
 * Staff authentication state.
 *
 * Implements the Phase 1 auth system exactly as designed — email + password
 * (step 1), TOTP 2FA verification (step 2), rotating access/refresh token
 * pair, transparent refresh on 401, and a hard role gate: only STAFF or
 * ADMIN may hold a staff session. 2FA is never bypassed; no staff data is
 * reachable without a token the backend has signed.
 *
 * Tokens live in sessionStorage (tab-scoped, cleared on browser close) —
 * this is an institutional shared-workstation product, so we deliberately
 * do not persist sessions to localStorage across restarts.
 */

const ACCESS_KEY = "signova.staff.accessToken";
const REFRESH_KEY = "signova.staff.refreshToken";
const USER_KEY = "signova.staff.user";

export type LoginStage =
  | { kind: "credentials" }
  | { kind: "twoFactor"; challengeToken: string }
  | { kind: "enroll"; challengeToken: string }
  | { kind: "register" }
  | { kind: "forgot" }
  | { kind: "reset"; token: string };

export interface StaffAuthValue {
  /** null while the boot check runs. */
  user: StaffUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginStage: LoginStage | null;
  loginError: string | null;
  isSubmitting: boolean;
  enrollment: { secret: string; otpauthUrl: string; qrDataUrl: string } | null;

  signIn: (email: string, password: string) => Promise<void>;
  verifyCode: (code: string) => Promise<void>;
  beginEnrollment: () => Promise<void>;
  confirmEnrollment: (code: string) => Promise<void>;
  cancelLogin: () => void;
  signOut: () => Promise<void>;
  /** Open the create-an-account step. */
  showRegister: () => void;
  /** Register a new staff account, then move into 2FA enrollment. */
  register: (name: string, organizationId: string, email: string, password: string) => Promise<void>;
  /** Open the forgot-password step. */
  showForgot: () => void;
  /** Request a reset link (always shows the generic confirmation). */
  requestReset: (email: string) => Promise<void>;
  /** Set a new password using the reset token from the URL. */
  confirmReset: (password: string) => Promise<void>;
  /** Open the reset form from a URL ?token=. */
  openResetFromUrl: (token: string) => void;
  /** Attempt a silent refresh; returns true when a new pair was obtained. */
  tryRefresh: () => Promise<boolean>;
}

const StaffAuthContext = createContext<StaffAuthValue | null>(null);

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — session simply won't survive reload */
  }
}

function clearSessionStorage(): void {
  writeSession(ACCESS_KEY, null);
  writeSession(REFRESH_KEY, null);
  writeSession(USER_KEY, null);
}

export function StaffAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<StaffUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loginStage, setLoginStage] = useState<LoginStage | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [enrollment, setEnrollment] = useState<StaffAuthValue["enrollment"]>(null);

  const accessToken = useRef<string | null>(null);
  const refreshToken = useRef<string | null>(null);
  const refreshing = useRef<Promise<boolean> | null>(null);

  const storePair = useCallback((access: string, refresh: string) => {
    accessToken.current = access;
    refreshToken.current = refresh;
    writeSession(ACCESS_KEY, access);
    writeSession(REFRESH_KEY, refresh);
  }, []);

  const storeUser = useCallback((next: StaffUser | null) => {
    setUser(next);
    writeSession(USER_KEY, next ? JSON.stringify(next) : null);
  }, []);

  const dropSession = useCallback(() => {
    accessToken.current = null;
    refreshToken.current = null;
    clearSessionStorage();
    storeUser(null);
    setLoginStage(null);
    setEnrollment(null);
    disconnectStaffSocket();
  }, [storeUser]);

  /** Accept a completed login result, enforcing the staff role gate. */
  const adoptSession = useCallback(
    (result: { accessToken?: string; refreshToken?: string; user?: StaffUser }) => {
      const nextUser = result.user;
      if (!result.accessToken || !result.refreshToken || !nextUser) {
        throw new Error("Sign-in did not return a session.");
      }
      if (nextUser.role !== "STAFF" && nextUser.role !== "ADMIN") {
        // A Deaf-user device token must never open the staff dashboard.
        throw new Error("This account does not have staff access.");
      }
      storePair(result.accessToken, result.refreshToken);
      storeUser(nextUser);
      setLoginStage(null);
      setLoginError(null);
    },
    [storePair, storeUser],
  );

  const tryRefresh = useCallback(async (): Promise<boolean> => {
    const token = refreshToken.current;
    if (!token) return false;
    // Single-flight: concurrent 401s share one refresh call.
    if (!refreshing.current) {
      refreshing.current = (async () => {
        try {
          const pair = await api.refresh(token);
          storePair(pair.accessToken, pair.refreshToken);
          return true;
        } catch {
          dropSession();
          return false;
        } finally {
          refreshing.current = null;
        }
      })();
    }
    return refreshing.current;
  }, [dropSession, storePair]);

  // Bind the API client to the token accessors above.
  useEffect(() => {
    bindAuthAccessors({
      getAccessToken: () => accessToken.current,
      refreshTokens: tryRefresh,
    });
  }, [tryRefresh]);

  /** Boot: if a pair survives in this tab, validate it with /auth/me. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const storedAccess = readSession(ACCESS_KEY);
      const storedRefresh = readSession(REFRESH_KEY);
      if (!storedAccess || !storedRefresh) {
        if (!cancelled) setIsLoading(false);
        return;
      }
      accessToken.current = storedAccess;
      refreshToken.current = storedRefresh;
      try {
        const { user: me } = await api.me();
        if (cancelled) return;
        if (me.role !== "STAFF" && me.role !== "ADMIN") {
          dropSession();
          return;
        }
        storeUser(me);
      } catch {
        if (cancelled) return;
        // Expired pair: one silent refresh before giving up.
        const refreshed = await tryRefresh();
        if (!refreshed || cancelled) return;
        try {
          const { user: me } = await api.me();
          if (!cancelled) storeUser(me);
        } catch {
          if (!cancelled) dropSession();
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [dropSession, storeUser, tryRefresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      setIsSubmitting(true);
      setLoginError(null);
      try {
        const result = await api.login(email, password);
        if (result.status === "authenticated") {
          adoptSession(result);
        } else if (result.status === "2fa_required" && result.challengeToken) {
          setLoginStage({ kind: "twoFactor", challengeToken: result.challengeToken });
        } else if (result.status === "mfa_enroll_required" && result.challengeToken) {
          setLoginStage({ kind: "enroll", challengeToken: result.challengeToken });
        } else {
          setLoginError("Unexpected sign-in response from the server.");
        }
      } catch (err) {
        setLoginError(describeAuthError(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [adoptSession],
  );

  const verifyCode = useCallback(
    async (code: string) => {
      if (loginStage?.kind !== "twoFactor") return;
      setIsSubmitting(true);
      setLoginError(null);
      try {
        const result = await api.verifyTwoFactor(loginStage.challengeToken, code);
        adoptSession(result);
      } catch (err) {
        setLoginError(describeAuthError(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [adoptSession, loginStage],
  );

  const beginEnrollment = useCallback(async () => {
    if (loginStage?.kind !== "enroll") return;
    setIsSubmitting(true);
    setLoginError(null);
    try {
      const enroll = await api.enrollTwoFactorStart(loginStage.challengeToken);
      setEnrollment({ secret: enroll.secret, otpauthUrl: enroll.otpauthUrl, qrDataUrl: enroll.qrDataUrl });
    } catch (err) {
      setLoginError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [loginStage]);

  const confirmEnrollment = useCallback(
    async (code: string) => {
      if (loginStage?.kind !== "enroll") return;
      setIsSubmitting(true);
      setLoginError(null);
      try {
        const result = await api.enrollTwoFactorActivate(loginStage.challengeToken, code);
        adoptSession(result);
      } catch (err) {
        setLoginError(describeAuthError(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [adoptSession, loginStage],
  );

  const cancelLogin = useCallback(() => {
    setLoginStage(null);
    setLoginError(null);
    setEnrollment(null);
  }, []);

  const showRegister = useCallback(() => {
    setLoginStage({ kind: "register" });
    setLoginError(null);
    setEnrollment(null);
  }, []);

  const register = useCallback(
    async (name: string, organizationId: string, email: string, password: string) => {
      setIsSubmitting(true);
      setLoginError(null);
      try {
        const result = await api.register(name, organizationId, email, password);
        // The backend always returns mfa_enroll_required for a fresh
        // account — straight into the QR enrollment step.
        if (result.status === "mfa_enroll_required" && result.challengeToken) {
          setLoginStage({ kind: "enroll", challengeToken: result.challengeToken });
        } else if (result.status === "authenticated") {
          adoptSession(result);
        } else {
          setLoginError("Unexpected response from the server.");
        }
      } catch (err) {
        setLoginError(describeAuthError(err));
      } finally {
        setIsSubmitting(false);
      }
    },
    [adoptSession],
  );

  const showForgot = useCallback(() => {
    setLoginStage({ kind: "forgot" });
    setLoginError(null);
    setEnrollment(null);
  }, []);

  const requestReset = useCallback(async (email: string) => {
    setIsSubmitting(true);
    setLoginError(null);
    try {
      await api.forgotPassword(email.trim());
      // Success is always shown — the backend returns the same generic
      // message whether or not the account exists. No enumeration.
      setLoginStage({ kind: "reset", token: "__sent__" });
    } catch (err) {
      setLoginError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const confirmReset = useCallback(async (password: string) => {
    // The token lives in the stage; guarded below.
    setIsSubmitting(true);
    setLoginError(null);
    try {
      if (loginStage?.kind !== "reset" || loginStage.token === "__sent__") {
        throw new Error("No active password-reset session.");
      }
      await api.resetPassword(loginStage.token, password);
      // No session is issued — send the user back to sign in.
      setLoginStage({ kind: "credentials" });
      setLoginError(null);
    } catch (err) {
      setLoginError(describeAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  }, [loginStage]);

  /** Called by App when the URL carries a ?token= — opens the reset form. */
  const openResetFromUrl = useCallback((token: string) => {
    setLoginStage({ kind: "reset", token });
    setLoginError(null);
    setEnrollment(null);
  }, []);

  const signOut = useCallback(async () => {
    const token = refreshToken.current;
    try {
      if (token) await api.logout(token);
    } catch {
      /* server-side revoke failed — local teardown still proceeds */
    }
    dropSession();
  }, [dropSession]);

  const value = useMemo<StaffAuthValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      loginStage,
      loginError,
      isSubmitting,
      enrollment,
      signIn,
      verifyCode,
      beginEnrollment,
      confirmEnrollment,
      cancelLogin,
      signOut,
      showRegister,
      register,
      showForgot,
      requestReset,
      confirmReset,
      openResetFromUrl,
      tryRefresh,
    }),
    [
      user,
      isLoading,
      loginStage,
      loginError,
      isSubmitting,
      enrollment,
      signIn,
      verifyCode,
      beginEnrollment,
      confirmEnrollment,
      cancelLogin,
      signOut,
      showRegister,
      register,
      showForgot,
      requestReset,
      confirmReset,
      openResetFromUrl,
      tryRefresh,
    ],
  );

  return <StaffAuthContext.Provider value={value}>{children}</StaffAuthContext.Provider>;
}

export function useStaffAuth(): StaffAuthValue {
  const ctx = useContext(StaffAuthContext);
  if (!ctx) throw new Error("useStaffAuth must be used inside <StaffAuthProvider>");
  return ctx;
}

function describeAuthError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.code) {
      case "INVALID_CREDENTIALS":
        return "That email and password combination is not correct.";
      case "ACCOUNT_LOCKED":
        return "This account is temporarily locked after too many failed attempts. Try again later.";
      case "ACCOUNT_INACTIVE":
        return "This account has been deactivated. Contact your administrator.";
      case "OTP_INVALID":
        return "That authentication code is not valid. Check your authenticator app and try again.";
      case "CHALLENGE_INVALID":
        return "Your sign-in session expired. Please start again.";
      case "RATE_LIMITED":
        return "Too many attempts. Please wait a moment and try again.";
      case "NETWORK_ERROR":
        return "Could not reach the Signova service. Check that the server is running.";
      case "CONFLICT":
        return "An account with this email already exists. Try signing in instead.";
      case "EMAIL_DOMAIN_NOT_ALLOWED":
        return "Staff registration is limited to gmail.com addresses. Use a gmail.com email to create your account.";
      case "ORGANIZATION_INVALID":
        return "Select a valid organization from the list.";
      case "RESET_TOKEN_INVALID":
        return "This password-reset link is invalid or has expired. Please request a new one.";
      case "VALIDATION_ERROR":
        return (err.details as Array<{ message: string }> | undefined)?.[0]?.message ?? "Check the highlighted fields and try again.";
      default:
        return err.message || "Sign-in failed. Please try again.";
    }
  }
  if (err instanceof Error) return err.message;
  return "Sign-in failed. Please try again.";
}
