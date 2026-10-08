import { API_BASE_URL } from "../config";
import type {
  Organisation,
  Teller,
  KioskSessionResponse,
  MessageRecord,
  TranslateResponse,
  SessionRecord,
} from "../../../../shared/types/mobile";

/**
 * Typed REST client for the Signova backend.
 *
 * Device/session calls pass a Bearer token (the DEAF_USER token issued at
 * session creation). Public kiosk calls need no token.
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

let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: unknown;
  /** Include the current auth token (default true when one is set). */
  auth?: boolean;
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const useAuth = opts.auth ?? true;
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (useAuth && authToken) headers.authorization = `Bearer ${authToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, {
      method: opts.method ?? "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch (networkErr) {
    // fetch only rejects on network failure (server unreachable, offline).
    throw new ApiError(0, "NETWORK_ERROR", "Could not reach the Signova service.", networkErr);
  }

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const err = (data as { error?: { code?: string; message?: string; details?: unknown } })?.error;
    throw new ApiError(
      res.status,
      err?.code ?? "UNKNOWN",
      err?.message ?? `Request failed (${res.status})`,
      err?.details,
    );
  }

  return data as T;
}

/* ---------- Public kiosk endpoints (no auth) ---------- */

export const api = {
  getOrganisation: () =>
    request<{ organization: Organisation }>("/api/kiosk/organization", { auth: false }),

  getTellers: () =>
    request<{ organizationId: string; tellers: Teller[] }>("/api/kiosk/tellers", { auth: false }),

  createSession: (input: { tellerId: string; method: "sign" | "text"; deviceId: string }) =>
    request<KioskSessionResponse>("/api/kiosk/sessions", {
      method: "POST",
      body: input,
      auth: false,
    }),

  /* ---------- Session-scoped endpoints (auth required) ---------- */

  getMessages: (sessionId: string) =>
    request<{ messages: MessageRecord[] }>(`/api/sessions/${sessionId}/messages`),

  sendMessage: (
    sessionId: string,
    body: {
      sender: "USER" | "STAFF";
      text: string;
      method: "sign" | "text" | "speech";
      confidence?: number;
      isConfirmed?: boolean;
    },
  ) =>
    request<{ message: MessageRecord }>(`/api/sessions/${sessionId}/messages`, {
      method: "POST",
      body,
    }),

  translate: (sessionId: string, body: { input?: unknown; durationMs?: number }) =>
    request<TranslateResponse>(`/api/sessions/${sessionId}/translate`, { method: "POST", body }),

  endSession: (sessionId: string) =>
    request<{ session: SessionRecord }>(`/api/sessions/${sessionId}/status`, {
      method: "PATCH",
      body: { status: "ENDED", endReason: "USER_ENDED" },
    }),
};
