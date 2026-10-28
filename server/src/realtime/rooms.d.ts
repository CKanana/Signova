import type { Server, Socket } from "socket.io";
import type { AccessTokenPayload } from "../utils/jwt.js";
/**
 * Register Socket.IO event handlers for an authenticated socket.
 * Every handler re-checks organization ownership server-side — a client can
 * never act on another organization's session, even with a valid token.
 */
export declare function registerSocketHandlers(io: Server, socket: Socket & {
    auth?: AccessTokenPayload;
}): void;
