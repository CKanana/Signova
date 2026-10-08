import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config";
import { setAuthToken } from "./api";

/**
 * Socket.IO client for the Signova realtime layer (/signova namespace).
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
};

export type SessionConnectedPayload = { sessionId: string; status: string };
export type SessionEndedPayload = { sessionId: string; summary?: { messageCount?: number } };
export type SocketErrorPayload = { message: string };

type Handlers = {
  onStaffMessage?: (m: StaffMessagePayload) => void;
  onSessionConnected?: (p: SessionConnectedPayload) => void;
  onSessionEnded?: (p: SessionEndedPayload) => void;
  onError?: (e: SocketErrorPayload) => void;
  onConnectionChange?: (connected: boolean) => void;
};

let socket: Socket | null = null;
let currentSessionId: string | null = null;

export function isConnected(): boolean {
  return socket?.connected ?? false;
}

/** Connect (or reuse) the socket and join a session room. */
export function connectSocket(token: string, sessionId: string, handlers: Handlers = {}): Socket {
  // Reconfigure token if reconnecting.
  setAuthToken(token);

  if (socket && currentSessionId === sessionId && socket.connected) {
    return socket;
  }

  // Tear down any previous socket.
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }

  currentSessionId = sessionId;

  socket = io(`${API_BASE_URL}/signova`, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
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
  socket.on("staff:message", (m: StaffMessagePayload) => handlers.onStaffMessage?.(m));
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
