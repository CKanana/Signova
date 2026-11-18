import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config";
import { setAuthToken } from "./api";

/** Socket.IO client for the Signova realtime layer (/signova namespace).
 *
 * Connects with the device/session access token and exposes a tiny
 * subscribe/unsubscribe API so screens can react to server events without
 * knowing about socket.io directly. Transport: websocket with polling fallback.
 */

export type StaffMessagePayload = {
  id: string;
  sessionId: string;
  sender: "USER" | "STAFF";
  text: string;
  method: string;
  confidence?: number;
  isConfirmed: boolean;
  timestamp: string;
  /** Phase 2: URL of the generated 2D SignBridge MP4 (null until generation completes). */
  animationUrl: string | null;
  /** Phase 2: async generation status: pending | generating | completed | failed. */
  generationStatus: "pending" | "generating" | "completed" | "failed";
  /** Phase 2: full animation object (optional, additive). */
  animation?: {
    status: "pending" | "ready" | "failed" | "skipped";
    url: string | null;
    durationMs: number | null;
    requestedAt: string | null;
    readyAt: string | null;
    error: string | null;
  } | null;
};

export type NewMessagePayload = StaffMessagePayload;

export type SessionConnectedPayload = { sessionId: string; status: string };
export type SessionActivePayload = { sessionId: string; tellerId: string; status: "ACTIVE" };
export type SessionRejectedPayload = { sessionId: string; status: "CANCELLED" };
export type SessionEndedPayload = { sessionId: string; summary?: { messageCount?: number } };
export type SocketErrorPayload = { message: string };

export type AnimationPayload = {
  sessionId: string;
  messageId: string;
  status: "pending" | "ready" | "failed" | "skipped";
  url: string | null;
  durationMs: number | null;
};

type Handlers = {
  onStaffMessage?: (m: StaffMessagePayload) => void;
  onNewMessage?: (m: NewMessagePayload) => void;
  onAnimation?: (p: AnimationPayload) => void;
  onSessionConnected?: (p: SessionConnectedPayload) => void;
  onSessionActive?: (p: SessionActivePayload) => void;
  onSessionRejected?: (p: SessionRejectedPayload) => void;
  onSessionEnded?: (p: SessionEndedPayload) => void;
  onError?: (e: SocketErrorPayload) => void;
  onConnectionChange?: (connected: boolean) => void;
};

let socket: Socket | null = null;
/** Current session room. */
let currentSessionId: string | null = null;

/**
 * Connect (or reuse) the socket and join a session room.
 */
export function connectSocket(token: string, sessionId: string, handlers: Handlers = {}): Socket {
  setAuthToken(token);

  if (socket && currentSessionId === sessionId && socket.connected) {
    return socket;
  }

  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentSessionId = sessionId;

  // The server's Socket.IO middleware reads the Bearer token from the
  // `authorization` header of the handshake (see gateway.ts: nsp.use).
  // socket.io-client does NOT forward a plain { token } object as a Bearer
  // auth header, so the connection is rejected with AUTH_REQUIRED before any
  // handler runs. Pass the token as the authorization header instead.
  socket = io(`${API_BASE_URL}/signova`, {
    auth: { token }, // forwarded to the handshake auth property (server ignores it)
    extraHeaders: { authorization: `Bearer ${token}` },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    timeout: 20000,
  });

  socket.on("connect", () => {
    handlers.onConnectionChange?.(true);
    socket?.emit("session:join", { sessionId });
  });

  socket.on("disconnect", () => handlers.onConnectionChange?.(false));
  socket.on("connect_error", () => handlers.onConnectionChange?.(false));

  socket.on("session:connected", (p: SessionConnectedPayload) =>
    handlers.onSessionConnected?.(p),
  );
  socket.on("session:active", (p: SessionActivePayload) =>
    handlers.onSessionActive?.(p),
  );
  socket.on("message:animation", (p: AnimationPayload) =>
    handlers.onAnimation?.(p),
  );
  socket.on("session:rejected", (p: SessionRejectedPayload) =>
    handlers.onSessionRejected?.(p),
  );
  socket.on("staff:message", (m: StaffMessagePayload) => handlers.onStaffMessage?.(m));
  socket.on("message:new", (m: NewMessagePayload) => handlers.onNewMessage?.(m));
  socket.on("session:ended", (p: SessionEndedPayload) => handlers.onSessionEnded?.(p));
  socket.on("error", (e: SocketErrorPayload) => handlers.onError?.(e));

  return socket;
}

/** Emit a message over the socket (the backend also accepts it via REST). */
export function emitMessage(sessionId: string, payload: Record<string, unknown>): void {
  socket?.emit("message:send", { sessionId, ...payload });
}

/** Emit session end over the socket. */
export function emitSessionEnd(sessionId: string): void {
  socket?.emit("session:end", { sessionId });
}

/** Leave and disconnect the socket (on session end / app reset). */
export function disconnectSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  currentSessionId = null;
}

export function isConnected(): boolean {
  return socket?.connected ?? false;
}
