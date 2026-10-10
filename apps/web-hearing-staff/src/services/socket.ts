import { io, type Socket } from "socket.io-client";
import { API_BASE_URL } from "../config";
import {
  NAMESPACE,
  C2S,
  S2C_STAFF,
  SOCKET_ERROR,
  type SessionRequestPayload,
  type SessionActivePayload,
  type TranslationLowPayload,
  type SessionEndedPayload,
  type WireMessage,
} from "./events";

/**
 * Socket.IO client for the staff dashboard's realtime layer.
 *
 * Reuses the Phase 1 infrastructure exactly: the /signova namespace, the
 * Bearer-token handshake, the org teller room (staff sockets auto-join it
 * in the gateway), and the session:join / message:send / session:end
 * events. There is no second realtime implementation — this module is the
 * only place the dashboard touches the socket.
 *
 * Connection states surfaced to the UI: connecting → connected, and on
 * failure reconnect → reconnecting → disconnected. Socket.IO handles
 * reconnection automatically; we mirror its state for the status pill.
 */

export type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting" | "disconnected";

export interface StaffSocketHandlers {
  onSessionRequest?: (p: SessionRequestPayload) => void;
  onSessionActive?: (p: SessionActivePayload) => void;
  onNewMessage?: (m: WireMessage) => void;
  onTranslationLow?: (p: TranslationLowPayload) => void;
  onSessionEnded?: (p: SessionEndedPayload) => void;
  onError?: (message: string) => void;
  onConnectionChange?: (state: ConnectionState) => void;
}

let socket: Socket | null = null;
let state: ConnectionState = "idle";
let connectedToken: string | null = null;

export function getConnectionState(): ConnectionState {
  return state;
}

function setState(next: ConnectionState, handlers: StaffSocketHandlers): void {
  if (state === next) return;
  state = next;
  handlers.onConnectionChange?.(next);
}

/**
 * Connect (or reuse) the staff socket with the staff access token.
 * The gateway verifies the token, and staff sockets automatically join
 * `org:<orgId>:tellers` where session:request arrives.
 */
export function connectStaffSocket(token: string, handlers: StaffSocketHandlers = {}): Socket {
  if (socket && connectedToken === token && (socket.connected || state === "connecting")) {
    return socket;
  }
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connectedToken = token;

  socket = io(`${API_BASE_URL}${NAMESPACE}`, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
  });

  setState("connecting", handlers);

  socket.on("connect", () => setState("connected", handlers));
  socket.on("disconnect", () => setState("disconnected", handlers));
  socket.io.on("reconnect_attempt", () => setState("reconnecting", handlers));
  socket.on("connect_error", () => {
    if (state === "connecting") setState("reconnecting", handlers);
  });

  socket.on(S2C_STAFF.SESSION_REQUEST, (p: SessionRequestPayload) =>
    handlers.onSessionRequest?.(p),
  );
  socket.on(S2C_STAFF.SESSION_ACTIVE, (p: SessionActivePayload) =>
    handlers.onSessionActive?.(p),
  );
  socket.on(S2C_STAFF.MESSAGE_NEW, (m: WireMessage) => handlers.onNewMessage?.(m));
  socket.on(S2C_STAFF.TRANSLATION_LOW, (p: TranslationLowPayload) =>
    handlers.onTranslationLow?.(p),
  );
  socket.on(S2C_STAFF.SESSION_ENDED, (p: SessionEndedPayload) =>
    handlers.onSessionEnded?.(p),
  );
  socket.on(SOCKET_ERROR, (p: { message?: string }) =>
    handlers.onError?.(p?.message ?? "The Signova service reported an error."),
  );

  return socket;
}

/** Join the room for a session the staff member has accepted. */
export function joinSession(sessionId: string): void {
  socket?.emit(C2S.SESSION_JOIN, { sessionId });
}

/** Leave the session room (after end / reset) without tearing down the socket. */
export function leaveSession(sessionId: string): void {
  socket?.emit("session:leave", { sessionId });
}

/**
 * Send a staff reply over the socket. The server derives the sender from
 * the token's role (STAFF), persists once, and broadcasts staff:message to
 * the session room — where the Deaf-user mobile client is listening. The
 * staff member's own socket (in the session room) receives the broadcast
 * back as message:new, which is the send confirmation.
 */
export function sendStaffMessage(
  sessionId: string,
  text: string,
  method: "speech" | "text" = "speech",
): void {
  socket?.emit(C2S.MESSAGE_SEND, { sessionId, text, method });
}

/** End the active session over the socket (frees the teller server-side). */
export function endSession(sessionId: string): void {
  socket?.emit(C2S.SESSION_END, { sessionId });
}

export function disconnectStaffSocket(): void {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
  connectedToken = null;
  state = "idle";
}
