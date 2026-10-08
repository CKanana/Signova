/** Canonical Socket.IO event names, shared by server and clients. */

// Mobile → Server
export const C2S = {
  SESSION_JOIN: "session:join",
  MESSAGE_SEND: "message:send",
  SESSION_END: "session:end",
} as const;

// Server → Mobile (Deaf user)
export const S2C_MOBILE = {
  SESSION_CONNECTED: "session:connected",
  STAFF_MESSAGE: "staff:message",
  SESSION_ENDED: "session:ended",
  ERROR: "error",
} as const;

// Server → Staff dashboard
export const S2C_STAFF = {
  SESSION_REQUEST: "session:request",
  SESSION_ACTIVE: "session:active",
  MESSAGE_NEW: "message:new",
  TRANSLATION_LOW: "translation:low",
  SESSION_ENDED: "session:ended",
} as const;

export const NAMESPACE = "/signova";

export function sessionRoom(sessionId: string): string {
  return `session:${sessionId}`;
}

export function orgTellersRoom(orgId: string): string {
  return `org:${orgId}:tellers`;
}

export function userRoom(userId: string): string {
  return `user:${userId}`;
}
