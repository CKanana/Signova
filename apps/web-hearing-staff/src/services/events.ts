/**
 * Canonical Socket.IO event names for the staff client.
 *
 * Mirrors server/src/realtime/events.ts exactly — the /signova namespace,
 * the C2S events a staff socket may emit, and the S2C staff events it may
 * receive. Room names are server-derived; the client never joins rooms by
 * name (the gateway auto-joins staff sockets to their org teller room on
 * connection, and session rooms are joined via the session:join handshake).
 */

export const NAMESPACE = "/signova";

/** Client → server. */
export const C2S = {
  SESSION_JOIN: "session:join",
  MESSAGE_SEND: "message:send",
  SESSION_END: "session:end",
} as const;

/** Server → client (staff dashboard events). */
export const S2C_STAFF = {
  SESSION_REQUEST: "session:request",
  SESSION_ACTIVE: "session:active",
  MESSAGE_NEW: "message:new",
  TRANSLATION_LOW: "translation:low",
  SESSION_ENDED: "session:ended",
} as const;

/** Server → client events shared with the mobile client. */
export const S2C_MOBILE = {
  SESSION_CONNECTED: "session:connected",
  STAFF_MESSAGE: "staff:message",
  SESSION_ENDED: "session:ended",
} as const;

/** Emitted on the socket on any server-side handler error. */
export const SOCKET_ERROR = "error" as const;

export interface SessionRequestPayload {
  sessionId: string;
  tellerId: string;
  method: "sign" | "text";
  startedAt: string;
}

export interface SessionActivePayload {
  sessionId: string;
}

export interface TranslationLowPayload {
  sessionId: string;
  confidence: number;
}

export interface SessionEndedPayload {
  sessionId: string;
  summary?: { messageCount?: number };
}

/** Serialized message shape (matches server rooms.ts serializeMessage). */
export interface WireMessage {
  id: string;
  sessionId: string;
  sender: "USER" | "STAFF";
  text: string;
  method: "sign" | "text" | "speech";
  confidence?: number;
  isConfirmed: boolean;
  timestamp: string;
}
