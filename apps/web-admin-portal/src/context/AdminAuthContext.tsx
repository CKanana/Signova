import {
  createContext,
  useContext,
  useCallback,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { adminApi, bindAuthAccessors, ApiError } from "../services/api";
import type { AdminUserSummary, OrganizationProfile } from "../types/admin";

const ACCESS_KEY = "signova.admin.accessToken";
const REFRESH_KEY = "signova.admin.refreshToken";
const USER_KEY = "signova.admin.user";

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
}

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
    // sessionStorage unavailable in restricted environments
  }
}

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminUserSummary | null>(() => {
    const raw = readStorage(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  });

  const [organization, setOrganization] = useState<OrganizationProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twoFactorStage, setTwoFactorStage] = useState<TwoFactorStage>({ kind: "none" });

  const accessTokenRef = useRef<string | null>(readStorage(ACCESS_KEY));
  const refreshTokenRef = useRef<string | null>(readStorage(REFRESH_KEY));
  const refreshingRef = useRef<Promise<boolean> | null>(null);

  const storeSession = useCallback((access: string, refresh: string, nextUser: AdminUserSummary) => {
    accessTokenRef.current = access;
    refreshTokenRef.current = refresh;
    writeStorage(ACCESS_KEY, access);
    writeStorage(REFRESH_KEY, refresh);
    writeStorage(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    setError(null);
    setTwoFactorStage({ kind: "none" });
  }, []);

  const dropSession = useCallback(() => {
    accessTokenRef.current = null;
    refreshTokenRef.current = null;
    writeStorage(ACCESS_KEY, null);
    writeStorage(REFRESH_KEY, null);
    writeStorage(USER_KEY, null);
    setUser(null);
    setOrganization(null);
    setTwoFactorStage({ kind: "none" });
  }, []);

  const tryRefresh = useCallback(async (): Promise<boolean> => {
    const rToken = refreshTokenRef.current;
    if (!rToken) return false;

    if (!refreshingRef.current) {
      refreshingRef.current = (async () => {
        try {
          const res = await adminApi.refresh(rToken);
          accessTokenRef.current = res.accessToken;
          refreshTokenRef.current = res.refreshToken;
          writeStorage(ACCESS_KEY, res.accessToken);
          writeStorage(REFRESH_KEY, res.refreshToken);
          return true;
        } catch {
          dropSession();
          return false;
        } finally {
          refreshingRef.current = null;
        }
      })();
    }
    return refreshingRef.current;
  }, [dropSession]);

  // Connect api.ts accessor to our in-memory/sessionStorage token refs
  useEffect(() => {
    bindAuthAccessors({
      getAccessToken: () => accessTokenRef.current,
      refreshTokens: tryRefresh,
    });
  }, [tryRefresh]);

  // Initial session hydration
  const reloadUser = useCallback(async () => {
    if (!accessTokenRef.current) {
      setIsLoading(false);
      return;
    }
    try {
      const res = await adminApi.me();
      if (res.user && res.user.role === "ADMIN") {
        setUser(res.user);
        writeStorage(USER_KEY, JSON.stringify(res.user));
      } else {
        dropSession();
      }
    } catch {
      dropSession();
    } finally {
      setIsLoading(false);
    }
  }, [dropSession]);

  useEffect(() => {
    reloadUser();
  }, [reloadUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await adminApi.login(email, password);

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
        const enrollData = await adminApi.enroll2FAStart(res.challengeToken);
        setTwoFactorStage({
          kind: "enroll",
          challengeToken: res.challengeToken,
          secret: enrollData.secret,
          otpauthUrl: enrollData.otpauthUrl,
          qrDataUrl: enrollData.qrDataUrl,
        });
        return;
      }

      if (res.status === "authenticated" && res.accessToken && res.refreshToken && res.user) {
        if (res.user.role !== "ADMIN") {
          throw new Error("Access denied: only administrators may access the Admin Portal.");
        }
        storeSession(res.accessToken, res.refreshToken, res.user);
      }
    } catch (err: any) {
      const msg = err?.message ?? "Sign-in failed. Please verify your credentials.";
      setError(msg);
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
      if (res.user.role !== "ADMIN") {
        throw new Error("Access denied: only administrators may access the Admin Portal.");
      }
      storeSession(res.accessToken, res.refreshToken, res.user);
    } catch (err: any) {
      const msg = err?.message ?? "Invalid verification code. Please check your authenticator.";
      setError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [twoFactorStage, storeSession]);

  const activateEnrollment = useCallback(async (challengeToken: string, code: string) => {
    if (twoFactorStage.kind !== "enroll") return;
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await adminApi.enroll2FAActivate(challengeToken, code);
      if (res.user.role !== "ADMIN") {
        throw new Error("Access denied: only administrators may access the Admin Portal.");
      }
      storeSession(res.accessToken, res.refreshToken, res.user);
    } catch (err: any) {
      const msg = err?.message ?? "Failed to activate two-factor authentication. Please check your code.";
      setError(msg);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }, [twoFactorStage, storeSession]);

  const cancelTwoFactor = useCallback(() => {
    setTwoFactorStage({ kind: "none" });
    setError(null);
  }, []);

  const signOut = useCallback(async () => {
    const rToken = refreshTokenRef.current;
    if (rToken) {
      try {
        await adminApi.logout(rToken);
      } catch {
        // Server revocation best-effort
      }
    }
    dropSession();
  }, [dropSession]);

  return (
    <AdminAuthContext.Provider
      value={{
        user,
        organization,
        isAuthenticated: !!user && user.role === "ADMIN",
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
