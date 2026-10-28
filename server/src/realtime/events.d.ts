/** Canonical Socket.IO event names, shared by server and clients. */
export declare const C2S: {
    readonly SESSION_JOIN: "session:join";
    readonly MESSAGE_SEND: "message:send";
    readonly SESSION_END: "session:end";
};
export declare const S2C_MOBILE: {
    readonly SESSION_CONNECTED: "session:connected";
    readonly STAFF_MESSAGE: "staff:message";
    readonly SESSION_ENDED: "session:ended";
    readonly ERROR: "error";
};
export declare const S2C_STAFF: {
    readonly SESSION_REQUEST: "session:request";
    readonly SESSION_ACTIVE: "session:active";
    readonly MESSAGE_NEW: "message:new";
    readonly TRANSLATION_LOW: "translation:low";
    readonly SESSION_ENDED: "session:ended";
};
export declare const NAMESPACE = "/signova";
export declare function sessionRoom(sessionId: string): string;
export declare function orgTellersRoom(orgId: string): string;
export declare function userRoom(userId: string): string;
