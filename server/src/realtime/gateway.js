import { Server as SocketServer } from "socket.io";
import { verifyAccessToken } from "../utils/jwt.js";
import { NAMESPACE } from "./events.js";
import { registerSocketHandlers } from "./rooms.js";
import { orgTellersRoom, S2C_STAFF } from "./events.js";
let io = null;
/**
 * Initialize the Socket.IO server on the /signova namespace.
 * Connections present a Bearer access token in the handshake; unauthenticated
 * sockets are rejected before any handler runs.
 */
export function initRealtime(httpServer) {
    io = new SocketServer(httpServer, {
        path: "/socket.io",
        cors: { origin: true, credentials: true },
    });
    const nsp = io.of(NAMESPACE);
    nsp.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token)
            return next(new Error("AUTH_REQUIRED"));
        try {
            const payload = verifyAccessToken(token);
            socket.auth = payload;
            next();
        }
        catch {
            next(new Error("AUTH_INVALID"));
        }
    });
    nsp.on("connection", (socket) => {
        registerSocketHandlers(io, socket);
    });
    return io;
}
export function getIO() {
    if (!io)
        throw new Error("Realtime not initialized");
    return io;
}
/** Emit a new-session request to a teller's org room (staff dashboards). */
export async function emitSessionRequest(orgId, session) {
    if (!io)
        return;
    io.of(NAMESPACE)
        .to(orgTellersRoom(orgId))
        .emit(S2C_STAFF.SESSION_REQUEST, {
        sessionId: session._id.toString(),
        tellerId: session.teller.toString(),
        method: session.method,
        startedAt: session.startedAt.toISOString(),
    });
}
//# sourceMappingURL=gateway.js.map