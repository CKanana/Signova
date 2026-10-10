import { API_BASE_URL } from "../config";
import type { Organisation, MessageRecord } from "../../../../shared/types/mobile";

/**
 * Typed REST client for the Signova staff dashboard.
 *
 * Authentication: staff sign in with email + password + TOTP 2FA and hold a
 * rotating access/refresh token pair (see auth.ts). The access token rides
 * on every request as a Bearer header; on 401 the store transparently
 * refreshes once with the refresh token before retrying. Authorization stays
 * server-side — this client never trusts its own role checks.
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface StaffUser {
  id: string;
  organization: string;
  role: "ADMIN" | "STAFF" | "DEAF_USER";
  name: string;
  email?: string;
  avatar?: string;
  twoFactorEnabled: boolean;
  isActive: boolean;
}

export interface AuthResult {
  status: "2fa_required" | "mfa_enroll_required" | "authenticated";
  challengeToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: StaffUser;
}

/**
 * Full session record as returned by the staff-facing endpoints. The
 * backend may return `teller`/`deafUser` either as raw ids or populated
 * documents, so both shapes are accepted.
 */
export interface SessionDetail {
  _id: string;
  organization: string;
  teller: string | { _id: string; name: string; serviceDesk: string; counterNumber: string };
  deafUser: string;
  method: "sign" | "text";
  status: "CONNECTING" | "ACTIVE" | "ENDED";
  pairingCode: string;
  messageCount: number;
  startedAt: string;
  endedAt?: string;
  endReason?: "USER_ENDED" | "STAFF_ENDED" | "TIMEOUT" | "ERROR";
}

/** Teller as returned by GET /api/tellers, including the staff assignment. */
export interface StaffTeller {
  _id: string;
  name: string;
  serviceLabel: string;
  serviceDesk: string;
  counterNumber: string;
  status: "FREE" | "BUSY" | "OFFLINE";
  pairingCode: string;
  staffUser?: string;
}

/** Injected by auth.ts so this module stays free of token storage concerns. */
let getAccessToken: (() => string | null) | null = null;
let refreshTokens: (() => Promise<boolean>) | null = null;

export function bindAuthAccessors(accessors: {
  getAccessToken: () => string | null;
  refreshTokens: () => Promise<boolean>;
}): void {
  getAccessToken = accessors.getAccessToken;
  refreshTokens = accessors.refreshTokens;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: unknown;
  /** Set false for login / refresh calls that must not attach a token. */
  auth?: boolean;
  /** Internal: prevents infinite refresh retry loops. */
  _retried?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "content-type": "application/json" };
  const useAuth = opts.auth ?? true;
  if (useAuth) {
    const token = getAccessToken?.();
    if (token) headers.authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
      credentials: "omit",
    });
  } catch {
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the Signova service. Check your connection and try again.");
  }

  if (res.status === 401 && useAuth && !opts._retried) {
    // One transparent refresh-and-retry, then give up with a clear signal.
    const refreshed = (await refreshTokens?.()) ?? false;
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true });
    }
  }

  const data = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string; details?: unknown };
  } | null;

  if (!res.ok) {
    throw new ApiError(
      res.status,
      data?.error?.code ?? "UNKNOWN",
      data?.error?.message ?? `Request failed (${res.status})`,
      data?.error?.details,
    );
  }

  return data as T;
}

export const api = {
  /* ---------- Authentication (token attached only after login) ---------- */

  login: (email: string, password: string) =>
    request<AuthResult>("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),

  register: (name: string, organizationId: string, email: string, password: string) =>
    request<AuthResult>("/api/auth/register", {
      method: "POST",
      body: { name, organizationId, email, password },
      auth: false,
    }),

  /** Public org list for the registration dropdown (id + name only). */
  listPublicOrganizations: () =>
    request<{ organizations: Array<{ _id: string; name: string }> }>("/api/organizations/public", {
      auth: false,
    }),

  /* ---------- Password recovery (staff-only, unauthenticated) ---------- */

  forgotPassword: (email: string) =>
    request<{ message: string }>("/api/auth/forgot-password", {
      method: "POST",
      body: { email },
      auth: false,
    }),

  resetPassword: (token: string, password: string) =>
    request<{ message: string }>("/api/auth/reset-password", {
      method: "POST",
      body: { token, password, passwordConfirmation: password },
      auth: false,
    }),

  verifyTwoFactor: (challengeToken: string, code: string) =>
    request<AuthResult>("/api/auth/2fa/verify", {
      method: "POST",
      body: { challengeToken, code },
      auth: false,
    }),

  enrollTwoFactorStart: (challengeToken: string) =>
    request<{ secret: string; otpauthUrl: string; qrDataUrl: string }>("/api/auth/2fa/enroll/start", {
      method: "POST",
      body: { challengeToken },
      auth: false,
    }),

  enrollTwoFactorActivate: (challengeToken: string, code: string) =>
    request<AuthResult>("/api/auth/2fa/enroll/activate", {
      method: "POST",
      body: { challengeToken, code },
      auth: false,
    }),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>("/api/auth/refresh", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    }),

  logout: (refreshToken: string) =>
    request<{ ok: boolean }>("/api/auth/logout", { method: "POST", body: { refreshToken } }),

  me: () => request<{ user: StaffUser }>("/api/auth/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ ok: boolean }>("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  /* ---------- Organization + tellers (staff-role reads) ---------- */

  getOrganization: () => request<{ organization: Organisation }>("/api/organizations/me"),

  listTellers: () => request<{ tellers: StaffTeller[] }>("/api/tellers"),

  setTellerAvailability: (tellerId: string, status: "FREE" | "OFFLINE") =>
    request<{ teller: StaffTeller }>(`/api/tellers/${tellerId}/availability`, {
      method: "PATCH",
      body: { status },
    }),

  /* ---------- Sessions ---------- */

  listSessions: (params: { tellerId?: string; status?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.tellerId) qs.set("tellerId", params.tellerId);
    if (params.status) qs.set("status", params.status);
    const query = qs.toString();
    return request<{ sessions: SessionDetail[] }>(`/api/sessions${query ? `?${query}` : ""}`);
  },

  getSession: (sessionId: string) => request<{ session: SessionDetail }>(`/api/sessions/${sessionId}`),

  endSession: (sessionId: string) =>
    request<{ session: SessionDetail }>(`/api/sessions/${sessionId}/status`, {
      method: "PATCH",
      body: { status: "ENDED", endReason: "STAFF_ENDED" },
    }),

  /* ---------- Messages ---------- */

  listMessages: (sessionId: string) =>
    request<{ messages: MessageRecord[] }>(`/api/sessions/${sessionId}/messages`),

  sendMessage: (
    sessionId: string,
    body: { sender: "USER" | "STAFF"; text: string; method: "sign" | "text" | "speech" },
  ) => request<{ message: MessageRecord }>(`/api/sessions/${sessionId}/messages`, {
    method: "POST",
    body,
  }),
};
