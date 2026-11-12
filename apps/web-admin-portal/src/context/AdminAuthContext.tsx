import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, bindAuthAccessors, ApiError } from "../services/api";
import type { AdminUserSummary, OrganizationProfile } from "../types/admin";

/** Minimal shape of an organization as surfaced to the web apps.
 * The mobile app uses the full OrganizationProfile; the web apps only
 * read the staff-facing subset (name, serviceName, logoUrl, colors). */

export type TwoFactorStage =
  | { kind: "none" }
  | { kind: "verify"; challengeToken: string }
  | {
      kind: "enroll";
      challengeToken: string;
      secret: string;
      otpauthUrl: string;
      qrDataUrl: string;
    };

export interface AdminAuthContextValue {
  user: AdminUserSummary | null;
  organization: OrganizationProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  twoFactorStage: TwoFactorStage;
  error: string | null;
  isSubmitting: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  verifyTwoFactor: (code: string) => Promise<void>;
  activateEnrollment: (challengeToken: string, code: string) => Promise<void>;
  cancelTwoFactor: () => void;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
  setOrganization: (org: OrganizationProfile | null) => void;
  loginWithGoogle: (googleIdToken: string) => Promise<void>;
}

const ACCESS_KEY = "signova.admin.accessToken";
const REFRESH_KEY = "signova.admin.refreshToken";
const USER_KEY = "signova.admin.user";

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

function readStorage(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.sessionStorage.removeItem(key);
    else window.sessionStorage.setItem(key, value);
  } catch {
    /* storage unavailable */
  }
}

function dropSession(): void {
  writeStorage(ACCESS_KEY, null);
  writeStorage(REFRESH_KEY, null);
  writeStorage(USER_KEY, null);
}

function isAdminUser(user: AdminUserSummary | null): boolean {
  return Boolean(user && user.role === "ADMIN");
}

function restoreSessionFromStorage():
  | { accessToken: string; refreshToken: string; user: AdminUserSummary }
  | null {
  const accessToken = readStorage(ACCESS_KEY);
  const refreshToken = readStorage(REFRESH_KEY);
  const rawUser = readStorage(USER_KEY);
  if (!accessToken || !refreshToken || !rawUser) return null;
  let user: AdminUserSummary;
  try {
    user = JSON.parse(rawUser) as AdminUserSummary;
  } catch {
    return null;
  }
  return { accessToken, refreshToken, user };
}

export function applyOrganizationTheme(colors: { primary: string; background: string }): void {
  document.documentElement.style.setProperty("--admin-primary", colors.primary);
  document.documentElement.style.setProperty("--admin-background", colors.background);
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const [user, setUser] = useState<AdminUserSummary | null>(null);
  const [organization, setOrganizationState] = useState<OrganizationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [twoFactorStage, setTwoFactorStage] = useState<TwoFactorStage>({ kind: "none" });

  const refreshTokensRef = useRef<string | null>(null);
  const authResponseRef = useRef<{ accessToken: string; refreshToken: string; user: AdminUserSummary } | null>(null);

  // --- Token refresh (called automatically on 401) ---
  const [refreshError, setRefreshError] = useState<string | null>(null);

  const refreshTokens = useCallback(async (): Promise<boolean> => {
    const rToken = refreshTokensRef.current;
    if (!rToken) {
      dropSession();
      return false;
    }
    try {
      // `auth: false` so the refresh call itself does not require a token.
      const res = await adminApi.refresh(rToken);
      if (res.accessToken) {
        writeStorage(ACCESS_KEY, res.accessToken);
        refreshTokensRef.current = res.refreshToken;
        setRefreshError(null);
        return true;
      }
      dropSession();
      return false;
    } catch {
      dropSession();
      return false;
    }
  }, []);

  // `storeSession` is hoisted above `loginWithGoogle` so the latter can call it.
  const storeSession = useCallback((access: string, refresh: string, nextUser: AdminUserSummary) => {
    writeStorage(ACCESS_KEY, access);
    writeStorage(REFRESH_KEY, refresh);
    writeStorage(USER_KEY, JSON.stringify(nextUser));
    refreshTokensRef.current = refresh;
    setUser(nextUser);
    // Wire token accessors every time a session is stored (fresh login or restore).
    // This ensures API calls immediately after login have a valid bearer token.
    bindAuthAccessors({
      getAccessToken: () => readStorage(ACCESS_KEY),
      refreshTokens,
    });
  }, [refreshTokens]);

  // --- Auth bootstrap ---
  useEffect(() => {
    const restored = restoreSessionFromStorage();
    if (restored) {
      authResponseRef.current = restored;
      if (isAdminUser(restored.user)) {
        setUser(restored.user);
        refreshTokensRef.current = restored.refreshToken;
        // Wire the token accessors (and enable transparent 401 retry) once the
        // session is restored. Tokens live in sessionStorage, so read from there
        // (not from `user`) so they are never stale after a re-render.
        bindAuthAccessors({
          getAccessToken: () => readStorage(ACCESS_KEY),
          refreshTokens,
        });
        void loadOrganization();
      } else {
        dropSession();
      }
    }
    setIsLoading(false);
  }, []);

  // --- Load org ---
  const loadOrganization = useCallback(async () => {
    try {
      const { profile } = await adminApi.getOrganizationSettings();
      setOrganizationState(profile);
      applyOrganizationTheme(profile.colors ?? { primary: "", background: "" });
    } catch {
      // Org is optional for anonymous setup; ignore.
    }
  }, []);

  // --- Logout ---
  const signOut = useCallback(async () => {
    const rToken = refreshTokensRef.current;
    if (rToken) {
      try {
        await adminApi.logout(rToken);
      } catch {
        // Server revocation best-effort
      }
    }
    dropSession();
    setUser(null);
    setOrganizationState(null);
    setTwoFactorStage({ kind: "none" });
    navigate("/admin/login", { replace: true });
  }, [navigate]);

  // --- Reload ---
  const reloadUser = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const retry = await adminApi.me();
      console.log("[auth] admin reloadUser me after refresh", { hasUser: Boolean(retry.user), role: retry.user?.role });
      if (retry.user && isAdminUser(retry.user)) {
        setUser(retry.user);
        writeStorage(USER_KEY, JSON.stringify(retry.user));
        void loadOrganization();
      } else {
        dropSession();
      }
    } catch {
      dropSession();
    } finally {
      setIsLoading(false);
    }
  }, [dropSession, loadOrganization]);

  // --- Google login ---
  const loginWithGoogle = useCallback(async (googleIdToken: string) => {
    try {
      const res = await adminApi.loginWithGoogle(googleIdToken);
      if (res.status === "google_account_not_found") {
        setError(res.message ?? "This Google account is not registered. Please sign up.");
        return;
      }
      if (res.status === "google_unverified") {
        setError(res.message ?? "This Google account email is not verified.");
        return;
      }
      // Existing user: TOTP challenge required. Google returns
      // `google_verified` for users who already have 2FA enabled,
      // and `google_login_2fa_required` for legacy accounts, so accept
      // either.
      if (res.status === "google_login_2fa_required" || res.status === "google_verified") {
        // Existing user: TOTP challenge required
        setTwoFactorStage({ kind: "verify", challengeToken: res.challengeToken ?? "" });
        return;
      }
      // `mfa_enroll_required` comes with a challenge token only; the
      // enrollment QR data is fetched separately via enroll2FAStart, so
      // do not read secret/otpauthUrl/qrDataUrl from this response.
      if (res.status === "mfa_enroll_required") {
        return;
      }
      if (res.status === "google_account_unlinked") {
        setError(res.message ?? "Google account could not be linked. Please try a different account.");
        return;
      }
      if (res.status === "authenticated" && res.accessToken && res.refreshToken && res.user) {
        if (!isAdminUser(res.user)) {
          throw new Error("Access denied: only administrators may access the Admin Portal.");
        }
        const payload = { accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user };
        authResponseRef.current = payload;
        storeSession(payload.accessToken, payload.refreshToken, payload.user);
      } else {
        setError(res.message ?? "Google sign-in failed. Please try again.");
      }
    } catch (err: any) {
      const msg = err?.message ?? "Google sign-in failed. Please try again.";
      setError(msg);
      console.log("[auth] admin loginWithGoogle error", { message: msg });
      throw err;
    }
  }, [storeSession]);

  const cancelTwoFactor = useCallback(() => {
    setTwoFactorStage({ kind: "none" });
    setError(null);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await adminApi.login(email, password);
      console.log("[auth] admin login", { status: res.status, hasUser: Boolean(res.user), hasChallenge: Boolean(res.challengeToken) });

      if (res.status === "pending_approval") {
        setError(res.message ?? "This administrator account is pending approval.");
        return;
      }

      if (res.status === "2fa_required" && res.challengeToken) {
        setTwoFactorStage({ kind: "verify", challengeToken: res.challengeToken });
        return;
      }

      if (res.status === "mfa_enroll_required" && res.challengeToken) {
        // Automatically request enrollment QR data
        void adminApi.enroll2FAStart(res.challengeToken).catch(() => {});
        setTwoFactorStage({
          kind: "enroll",
          challengeToken: res.challengeToken,
          // Enrollment details are fetched separately via enroll2FAStart,
          // so these are not available on the login response.
          secret: "",
          otpauthUrl: "",
          qrDataUrl: "",
        });
        return;
      }

      if (res.status === "authenticated" && res.accessToken && res.refreshToken && res.user) {
        if (!isAdminUser(res.user)) {
          throw new Error("Access denied: only administrators may access the Admin Portal.");
        }
        const payload = { accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user };
        authResponseRef.current = payload;
        storeSession(payload.accessToken, payload.refreshToken, payload.user);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Sign-in failed. Please verify your credentials.";
      setError(msg);
      console.log("[auth] admin login error", { message: msg });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [storeSession]);

  const verifyTwoFactor = useCallback(async (code: string) => {
    if (twoFactorStage.kind !== "verify") return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await adminApi.verify2FA(twoFactorStage.challengeToken, code);
      console.log("[auth] verify2FA", {
        status: res.status,
        hasAccessToken: !!res.accessToken,
        hasRefreshToken: !!res.refreshToken,
        hasUser: !!(res.user && res.user.role),
        userRole: res.user?.role,
      });
      if (!isAdminUser(res.user)) {
        throw new Error("Access denied: only administrators may access the Admin Portal.");
      }
      const payload = { accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user };
      authResponseRef.current = payload;
      storeSession(payload.accessToken, payload.refreshToken, payload.user);
      navigate("/admin/overview", { replace: true });
    } catch (err: any) {
      const msg = err?.message ?? "Invalid verification code. Please check your authenticator.";
      setError(msg);
      console.log("[auth] admin verify2FA error", { message: msg });
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [twoFactorStage, storeSession, navigate]);

  const activateEnrollment = useCallback(async (challengeToken: string, code: string) => {
    if (twoFactorStage.kind !== "enroll") return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await adminApi.enroll2FAActivate(challengeToken, code);
      if (!isAdminUser(res.user)) {
        throw new Error("Access denied: only administrators may access the Admin Portal.");
      }
      const payload = { accessToken: res.accessToken, refreshToken: res.refreshToken, user: res.user };
      authResponseRef.current = payload;
      storeSession(payload.accessToken, payload.refreshToken, payload.user);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to activate two-factor authentication. Please check your code.";
      setError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [twoFactorStage, storeSession]);

  const setOrganization = useCallback((org: OrganizationProfile | null) => {
    setOrganizationState(org);
    if (org?.colors) {
      applyOrganizationTheme(org.colors);
    }
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: isAdminUser(user),
        isLoading,
        twoFactorStage,
        error,
        isSubmitting,
        signIn,
        verifyTwoFactor,
        activateEnrollment,
        cancelTwoFactor,
        signOut,
        reloadUser,
        setOrganization,
        loginWithGoogle,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  return ctx;
}
