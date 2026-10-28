import type { Server as HttpServer } from "node:http";
import { Server as SocketServer } from "socket.io";
/**
 * Initialize the Socket.IO server on the /signova namespace.
 * Connections present a Bearer access token in the handshake; unauthenticated
 * sockets are rejected before any handler runs.
 */
export declare function initRealtime(httpServer: HttpServer): SocketServer;
export declare function getIO(): SocketServer;
/** Emit a new-session request to a teller's org room (staff dashboards). */
export declare function emitSessionRequest(orgId: string, session: any): Promise<void>;
