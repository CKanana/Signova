/** Canonical Socket.IO event names, shared by server and clients. */
// Mobile → Server
export const C2S = {
    SESSION_JOIN: "session:join",
    MESSAGE_SEND: "message:send",
    SESSION_END: "session:end",
};
// Server → Mobile (Deaf user)
export const S2C_MOBILE = {
    SESSION_CONNECTED: "session:connected",
    STAFF_MESSAGE: "staff:message",
    SESSION_ENDED: "session:ended",
    ERROR: "error",
};
// Server → Staff dashboard
export const S2C_STAFF = {
    SESSION_REQUEST: "session:request",
    SESSION_ACTIVE: "session:active",
    MESSAGE_NEW: "message:new",
    TRANSLATION_LOW: "translation:low",
    SESSION_ENDED: "session:ended",
};
export const NAMESPACE = "/signova";
export function sessionRoom(sessionId) {
    return `session:${sessionId}`;
}
export function orgTellersRoom(orgId) {
    return `org:${orgId}:tellers`;
}
export function userRoom(userId) {
    return `user:${userId}`;
}
//# sourceMappingURL=events.js.map