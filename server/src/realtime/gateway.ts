import type { Server as HttpServer } from "node:http";
import { Server as SocketServer, type Socket } from "socket.io";
import { verifyAccessToken, type AccessTokenPayload } from "../utils/jwt.js";
import { config } from "../config/env.js";
import { isDevTunnelOrigin } from "../middleware/security.js";
import { NAMESPACE } from "./events.js";
import { registerSocketHandlers } from "./rooms.js";
import { sessionRoom, orgTellersRoom, userRoom, S2C_STAFF } from "./events.js";
import { Session } from "../models/session.js";
import { Teller } from "../models/teller.js";
import { S2C_MOBILE } from "./events.js";

let io: SocketServer | null = null;

/**
 * Initialize the Socket.IO server on the /signova namespace.
 * Connections present a Bearer access token in the handshake; unauthenticated
 * sockets are rejected before any handler runs.
 */
export function initRealtime(httpServer: HttpServer): SocketServer {
  io = new SocketServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin(origin, callback) {
        // Non-browser clients (native apps, curl) send no Origin header.
        if (!origin) return callback(null, true);
        if (config.corsOrigins.includes(origin)) return callback(null, true);
        if (isDevTunnelOrigin(origin)) return callback(null, true);
        return callback(null, false);
      },
      credentials: true,
    },
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

/** Emit a new-session request only to the teller's assigned staff member.
 * Falls back to the whole org tellers room if no staff is assigned,
 * so admin dashboards always see incoming requests. */
export async function emitSessionRequest(orgId: string, session: any): Promise<void> {
  if (!io) return;

  const payload = {
    sessionId: session._id.toString(),
    tellerId: session.teller.toString(),
    method: session.method,
    startedAt: session.startedAt.toISOString(),
  };

  // Look up the teller to find the assigned staff member.
  const teller = await Teller.findOne({
    _id: session.teller,
    organization: orgId,
  }).select("staffUser").lean();

  const namespace = io.of(NAMESPACE);

  if (teller?.staffUser) {
    // Route directly to the assigned staff member's personal room.
    // This ensures only the right person gets the notification popup.
    namespace
      .to(userRoom(teller.staffUser.toString()))
      .emit(S2C_STAFF.SESSION_REQUEST, payload);
  } else {
    // No staff assigned — broadcast to all staff in the org so someone
    // can pick it up (e.g. admin or unassigned counter situation).
    namespace
      .to(orgTellersRoom(orgId))
      .emit(S2C_STAFF.SESSION_REQUEST, payload);
  }
}

/** Notify both parties that a session is now ACTIVE.
 *
 * Persisted state (acceptSession) is committed by the caller before this
 * is emitted. Emits to:
 *  - the accepting staff member's personal room (targeted ack)
 *  - the org tellers room (all staff dashboards in the org)
 *  - the session room (the Deaf user, once joined via session:join)
 */
export async function emitSessionActive(
  orgId: string,
  session: any,
  staffUserId?: string,
): Promise<void> {
  if (!io) return;
  const namespace = io.of(NAMESPACE);
  const payload = {
    sessionId: session._id.toString(),
    tellerId: session.teller.toString(),
    status: "ACTIVE",
  };

  if (staffUserId) {
    namespace.to(userRoom(staffUserId)).emit(S2C_STAFF.SESSION_ACTIVE, payload);
  }
  namespace.to(orgTellersRoom(orgId)).emit(S2C_STAFF.SESSION_ACTIVE, payload);
  namespace.to(sessionRoom(session._id.toString())).emit(S2C_MOBILE.SESSION_ACTIVE, payload);
}

/** Notify the Deaf user that their request was rejected.
 *
 * Persisted state (rejectSession) is committed by the caller before this
 * is emitted. Emits to the session room; a Deaf user who joins later
 * retrieves authoritative state via GET /api/sessions/current. */
export async function emitSessionRejected(orgId: string, session: any): Promise<void> {
  if (!io) return;
  const namespace = io.of(NAMESPACE);
  const payload = {
    sessionId: session._id.toString(),
    status: "CANCELLED",
  };
  namespace.to(sessionRoom(session._id.toString())).emit(S2C_MOBILE.SESSION_REJECTED, payload);
}

/** Notify both parties that a session has ended.
 *
 * Persisted state (updateSessionStatus → ENDED) is committed by the caller
 * before this is emitted. Emits to:
 *  - the session room (the Deaf user, once joined via session:join)
 *  - the org tellers room (all staff dashboards in the org) */
export async function emitSessionEnded(orgId: string, session: any): Promise<void> {
  if (!io) return;
  const namespace = io.of(NAMESPACE);
  const payload = {
    sessionId: session._id.toString(),
    status: "ENDED",
  };
  namespace.to(sessionRoom(session._id.toString())).emit(S2C_MOBILE.SESSION_ENDED, payload);
  namespace.to(orgTellersRoom(orgId)).emit(S2C_STAFF.SESSION_ENDED, payload);
}
