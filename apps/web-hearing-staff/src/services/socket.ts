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

/** Server → staff socket event names (ack/reject of a send). */
export const S2C_FROM_SENDER = {
  MESSAGE_ACKED: "message:acked",
  MESSAGE_REJECTED: "message:rejected",
} as const;

/** Connection states surfaced to the UI. */
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

/** Sending state of a pending staff message. Not complete until the server confirms. */
export interface PendingSend {
  id: string;
  /** The server's echoed messagePayload in the ack. */
  ackPayload: Record<string, unknown>;
  /** Resolve once the server confirms the message won't be rejected. */
  resolve: (payload: unknown) => void;
  /** Reject if the server rejects the send (normal path is resolve only). */
  reject: (error: Error) => void;
}

/**
 * In-memory store of sends awaiting server confirmation.
 *
 * A staff socket is in the session room, so the server's broadcast of
 * `message:new` to that room is a confirmation for the staff sender. But
 * broadcasting to the room is order-dependent with `message:send` handling,
 * and can be lost across reconnect. This store + the direct `message:acked`
 * path (emitted to the sender socket immediately after persisting) is the
 * reliable resolution mechanism.
 */
class PendingSendStore {
  private readonly awaiting = new Map<string, PendingSend>();

  add(send: PendingSend): string {
    const id = send.id ?? crypto.randomUUID();
    this.awaiting.set(id, send);
    return id;
  }

  complete(id: string, payload: Record<string, unknown>): Record<string, unknown> | null {
    const send = this.awaiting.get(id);
    if (!send) return null;
    this.awaiting.delete(id);
    send.resolve(payload);
    return payload;
  }

  reject(id: string, error: Error): void {
    const send = this.awaiting.get(id);
    if (!send) return;
    this.awaiting.delete(id);
    send.reject(error);
  }

  drop(id: string): void {
    this.awaiting.delete(id);
  }
}

export const pendingSendStore = new PendingSendStore();

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

/** Connect (or reuse) the staff socket with the staff access token. */
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
 * Send a staff reply over the socket, resolving when the server confirms the
 * message. The server derives the sender from the token's role (STAFF),
 * persists once, and (a) broadcasts message:new to the session room (which
 * the staff socket receives for its own message) and (b) emits a direct
 * message:acked to the sender socket. The Promise resolves on the direct ack,
 * which is order-independent and survives reconnect.
 *
 * @returns Promise that resolves with the server's echoed payload, or rejects
 *          on a socket-side error. Callers must await this for the send to be
 *          considered complete.
 */
export function sendStaffMessageAsync(
  sessionId: string,
  text: string,
  method: "speech" | "text" = "speech",
): Promise<void> {
  if (!socket || !socket.connected) {
    return Promise.reject(new Error("Not connected to the service."));
  }
  return new Promise<void>((resolve, reject) => {
    const ackPayload = { sessionId, text, method, timestamp: new Date().toISOString() } as Record<string, unknown>;
    const send: PendingSend = {
      id: `send-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      ackPayload,
      resolve: (payload: unknown) => {
        cleanup();
        pendingSendStore.drop(id);
        resolve(payload as never);
      },
      reject: (error: Error) => {
        cleanup();
        pendingSendStore.drop(id);
        reject(error);
      },
    };
    const id = pendingSendStore.add(send);

    // Resolve on server's direct ack (order-independent, survives reconnect).
    const onAcked = (ack: Record<string, unknown>) => {
      cleanup();
      pendingSendStore.drop(id);
      resolve(ack);
    };
    socket.on(S2C_FROM_SENDER.MESSAGE_ACKED, onAcked);
    // Also resolve via message:new in the session room (the staff socket's
    // own broadcast). Used as a fallback and as the confirmation for the
    // legacy fire-and-forget path.
    socket.on(S2C_STAFF.MESSAGE_NEW, (m: WireMessage) => {
      if (m.sessionId === sessionId && m.sender === "STAFF" && m.text === text && m.method === method) {
        const resolved = resolve as (value: unknown) => void;
        cleanup();
        pendingSendStore.drop(id);
        resolved(m);
      }
    });

    // Clean up callbacks once resolved.
    const cleanup = () => {
      socket?.off(S2C_FROM_SENDER.MESSAGE_ACKED, onAcked);
    };

    try {
      socket.emit(C2S.MESSAGE_SEND, { sessionId, text, method });
    } catch (err) {
      cleanup();
      pendingSendStore.drop(id);
      reject(err instanceof Error ? err : new Error("The server rejected this message."));
    }
  });
}

/** Send a staff reply (fire-and-forget, preserving the original API). */
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
