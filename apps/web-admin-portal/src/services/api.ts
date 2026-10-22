import type {
  AdminUserSummary,
  OrganizationProfile,
  Paginated,
  AuditLogEntry,
  AdminSession,
  Teller,
  OverviewMetrics,
  Role,
  TellerStatus,
  SessionStatus,
} from "../types/admin";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Token accessors injected by AdminAuthContext. */
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
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  params?: Record<string, string | number | boolean | undefined>;
  _retried?: boolean;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const useAuth = opts.auth ?? true;

  if (useAuth && getAccessToken) {
    const token = getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  let url = path;
  if (opts.params) {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(opts.params)) {
      if (val !== undefined && val !== null && val !== "") {
        searchParams.set(key, String(val));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += (url.includes("?") ? "&" : "?") + queryString;
    }
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (err: any) {
    throw new ApiError(0, "NETWORK_ERROR", "Could not connect to Signova service. Check your connection.");
  }

  if (res.status === 401 && useAuth && !opts._retried && refreshTokens) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, { ...opts, _retried: true });
    }
  }

  const json = await res.json().catch(() => null);

  if (!res.ok) {
    const code = json?.error?.code ?? "UNKNOWN_ERROR";
    const message = json?.error?.message ?? `Request failed with status ${res.status}`;
    const details = json?.error?.details;
    throw new ApiError(res.status, code, message, details);
  }

  return json as T;
}

export const adminApi = {
  // Authentication
  login: (email: string, password: string) =>
    request<{
      status: "authenticated" | "2fa_required" | "mfa_enroll_required" | "pending_approval";
      challengeToken?: string;
      accessToken?: string;
      refreshToken?: string;
      user?: AdminUserSummary;
      message?: string;
    }>("/api/admin/login", { method: "POST", body: { email, password }, auth: false }),

  verify2FA: (challengeToken: string, code: string) =>
    request<{
      status: "authenticated";
      accessToken: string;
      refreshToken: string;
      user: AdminUserSummary;
    }>("/api/admin/2fa/verify", { method: "POST", body: { challengeToken, code }, auth: false }),

  enroll2FAStart: (challengeToken: string) =>
    request<{
      secret: string;
      otpauthUrl: string;
      qrDataUrl: string;
    }>("/api/admin/2fa/enroll/start", { method: "POST", body: { challengeToken }, auth: false }),

  enroll2FAActivate: (challengeToken: string, code: string) =>
    request<{
      status: "authenticated";
      accessToken: string;
      refreshToken: string;
      user: AdminUserSummary;
    }>("/api/admin/2fa/enroll/activate", { method: "POST", body: { challengeToken, code }, auth: false }),

  bootstrapAccept: (token: string, password: string) =>
    request<{
      status: "mfa_enroll_required";
      challengeToken: string;
      user: { id: string; name: string; email?: string };
    }>("/api/admin/bootstrap/accept", { method: "POST", body: { token, password }, auth: false }),

  logout: (refreshToken: string) =>
    request<{ ok: boolean }>("/api/admin/logout", { method: "POST", body: { refreshToken }, auth: false }),

  refresh: (refreshToken: string) =>
    request<{ accessToken: string; refreshToken: string }>("/api/admin/refresh", {
      method: "POST",
      body: { refreshToken },
      auth: false,
    }),

  me: () => request<{ user: AdminUserSummary }>("/api/admin/me"),

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ message: string }>("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword, newPassword },
    }),

  // Overview
  getOverview: () => request<{ metrics: OverviewMetrics }>("/api/admin/overview"),

  // Staff management
  listStaff: (params?: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: "STAFF" | "ADMIN";
    status?: "active" | "inactive" | "pending";
    onlyActive?: boolean;
    onlyInactive?: boolean;
    onlyPending?: boolean;
  }) => request<Paginated<AdminUserSummary>>("/api/admin/staff", { params }),

  listPendingStaff: () => request<Paginated<AdminUserSummary>>("/api/admin/staff/pending"),

  getStaff: (id: string) => request<{ staff: AdminUserSummary }>(`/api/admin/staff/${id}`),

  createStaff: (data: { name: string; email: string; phone?: string; role: Role }) =>
    request<{ staff: AdminUserSummary }>("/api/admin/staff", { method: "POST", body: data }),

  updateStaff: (id: string, data: { name?: string; email?: string; phone?: string; role?: Role }) =>
    request<{ staff: AdminUserSummary }>(`/api/admin/staff/${id}`, { method: "PUT", body: data }),

  setStaffStatus: (id: string, active: boolean) =>
    request<{ staff: AdminUserSummary }>(`/api/admin/staff/${id}/status`, { method: "PATCH", body: { active } }),

  resetStaff2FA: (id: string) =>
    request<{ ok: boolean }>(`/api/admin/staff/${id}/2fa/reset`, { method: "POST" }),

  // Teller management
  listTellers: (params?: { page?: number; pageSize?: number; status?: TellerStatus; search?: string }) =>
    request<Paginated<Teller>>("/api/admin/tellers", { params }),

  getTeller: (id: string) => request<{ teller: Teller }>(`/api/admin/tellers/${id}`),

  createTeller: (data: {
    name: string;
    serviceLabel?: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser?: string;
    pairingCode?: string;
  }) => request<{ teller: Teller }>("/api/admin/tellers", { method: "POST", body: data }),

  updateTeller: (
    id: string,
    data: {
      name?: string;
      serviceLabel?: string;
      serviceDesk?: string;
      counterNumber?: string;
      staffUser?: string;
    }
  ) => request<{ teller: Teller }>(`/api/admin/tellers/${id}`, { method: "PUT", body: data }),

  setTellerStatus: (id: string, status: TellerStatus) =>
    request<{ teller: Teller }>(`/api/admin/tellers/${id}/status`, { method: "PATCH", body: { status } }),

  assignStaffToTeller: (id: string, staffUserId: string) =>
    request<{ teller: Teller }>(`/api/admin/tellers/${id}/assign`, { method: "POST", body: { staffUserId } }),

  // Sessions
  listSessions: (params?: { page?: number; pageSize?: number; tellerId?: string; status?: SessionStatus }) =>
    request<Paginated<AdminSession>>("/api/admin/sessions", { params }),

  getSession: (id: string) => request<{ session: AdminSession }>(`/api/admin/sessions/${id}`),

  // Audit logs
  listAuditLogs: (params?: {
    page?: number;
    pageSize?: number;
    action?: string;
    actor?: string;
    target?: string;
    from?: string;
    to?: string;
  }) => request<Paginated<AuditLogEntry>>("/api/admin/audit-logs", { params }),

  getAuditLogsCount: () => request<{ count: number }>("/api/admin/audit-logs/count"),

  // Organization settings
  getOrganizationSettings: () => request<{ profile: OrganizationProfile }>("/api/admin/organization/settings"),

  updateOrganizationSettings: (data: {
    name?: string;
    shortName?: string;
    welcomeMessage?: string;
    serviceName?: string;
    counterLabel?: string;
    colors?: { primary: string; background: string };
    logoUrl?: string;
    restrictRegistrationByDomain?: boolean;
    allowedEmailDomains?: string[];
  }) => request<{ profile: OrganizationProfile }>("/api/admin/organization/settings", { method: "PUT", body: data }),
};
