import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import { verifyAccessToken, type AccessTokenPayload } from "../utils/jwt.js";
import { NAMESPACE } from "./events.js";
import { registerSocketHandlers } from "./rooms.js";
import { sessionRoom, orgTellersRoom, S2C_STAFF } from "./events.js";
import { Session } from "../models/session.js";

let io: SocketServer | null = null;

/**
 * Initialize the Socket.IO server on the /signova namespace.
 * Connections present a Bearer access token in the handshake; unauthenticated
 * sockets are rejected before any handler runs.
 */
export function initRealtime(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: { origin: true, credentials: true },
  });

  const nsp = io.of(NAMESPACE);

  nsp.use((socket, next) => {
    const token = socket.handshake.auth?.token as string | undefined;
    if (!token) return next(new Error("AUTH_REQUIRED"));
    try {
      const payload = verifyAccessToken(token);
      (socket as Socket & { auth?: AccessTokenPayload }).auth = payload;
      next();
    } catch {
      next(new Error("AUTH_INVALID"));
    }
  });

  nsp.on("connection", (socket) => {
    registerSocketHandlers(io!, socket as Socket & { auth?: AccessTokenPayload });
  });

  return io;
}

export function getIO(): SocketServer {
  if (!io) throw new Error("Realtime not initialized");
  return io;
}

/** Emit a new-session request to a teller's org room (staff dashboards). */
export async function emitSessionRequest(orgId: string, session: any): Promise<void> {
  if (!io) return;
  io.of(NAMESPACE)
    .to(orgTellersRoom(orgId))
    .emit(S2C_STAFF.SESSION_REQUEST, {
      sessionId: session._id.toString(),
      tellerId: session.teller.toString(),
      method: session.method,
      startedAt: session.startedAt.toISOString(),
    });
}
