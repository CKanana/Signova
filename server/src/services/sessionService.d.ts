import type { Types } from "mongoose";
import type { CommunicationMethod, SessionEndReason } from "../../../shared/types/translation.js";
/** Accept both the mongoose runtime ObjectId and the schema-declared
 * Schema.Types.ObjectId, or a hex string. All three are valid _id values.
 */
type ObjectIdLike = Types.ObjectId | {
    toString(): string;
};
/** Process-local live-session registry.
 *
 * Mirrors the DB-level reservation so that a failed session creation
 * always releases the teller, and so that a concurrent availability
 * check cannot be re-run against a stale in-memory view.
 */
export declare const activeLeases: Map<string, string>;
export declare function acquireLease(sessionId: string, tellerId: string): void;
export declare function releaseLease(sessionId: string): void;
/** Ticker-aware availability read: checks the DB + the live lease set. */
export declare function tellerHasActiveSession(orgId: ObjectIdLike, tellerId: ObjectIdLike): Promise<boolean>;
/**
 * Atomically reserve a teller for a new session.
 *
 * The update condition `{ status: "FREE" }` means the teller is only
 * claimed if it is currently FREE. Returns the claimed teller (status
 * BUSY) or null if the reservation failed because the teller is not
 * FREE (another request won the race). This is a single atomic
 * MongoDB operation — no read-then-write TOCTOU race.
 */
export declare function reserveTeller(orgId: ObjectIdLike, tellerId: ObjectIdLike): Promise<import("../models/teller.js").ITeller | null>;
/** Release a reserved teller back to FREE (conditional update). */
export declare function releaseTeller(orgId: ObjectIdLike, tellerId: ObjectIdLike): Promise<import("../models/teller.js").ITeller | null>;
/** Ensure a SessionLog exists for a session. */
export declare function ensureSessionLog(sessionId: ObjectIdLike, orgId: ObjectIdLike): Promise<import("mongoose").Document<unknown, {}, import("../models/sessionLog.js").ISessionLog, {}, {}> & import("../models/sessionLog.js").ISessionLog & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
/** Append an event to the session log. */
export declare function logSessionEvent(sessionId: ObjectIdLike, orgId: ObjectIdLike, type: string, meta?: Record<string, unknown>): Promise<import("mongoose").Document<unknown, {}, import("../models/sessionLog.js").ISessionLog, {}, {}> & import("../models/sessionLog.js").ISessionLog & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
/** Record a translate latency sample. */
export declare function recordLatency(sessionId: ObjectIdLike, orgId: ObjectIdLike, ms: number): Promise<void>;
/**
 * Create a new session for a Deaf user pairing with a teller.
 *
 * Reservation is atomic: the teller is claimed with a single
 * findOneAndUpdate whose condition requires status FREE. On failure the
 * teller is released back to FREE within the same function, so a
 * rejected session never leaves the teller stuck BUSY. Live leases
 * track the reservation in-process; the authoritative state is the
 * teller's status field in MongoDB.
 */
export declare function createSession(orgId: ObjectIdLike, input: {
    tellerId?: string;
    pairingCode?: string;
    method: CommunicationMethod;
    deviceId: string;
}): Promise<import("../models/session.js").ISession>;
export declare function getCurrentSessionForDevice(orgId: ObjectIdLike, deviceId: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/session.js").ISession, {}, {}> & import("../models/session.js").ISession & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}) | null>;
export declare function getSessionById(orgId: ObjectIdLike, sessionId: string): Promise<import("mongoose").Document<unknown, {}, import("../models/session.js").ISession, {}, {}> & import("../models/session.js").ISession & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
/** List sessions — staff see their teller's; admin sees the whole org. */
export declare function listSessions(orgId: ObjectIdLike, opts?: {
    tellerId?: string;
    status?: string;
    limit?: number;
}): Promise<(import("mongoose").Document<unknown, {}, import("../models/session.js").ISession, {}, {}> & import("../models/session.js").ISession & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
})[]>;
/** Transition session status. On end, free the teller. */
export declare function updateSessionStatus(orgId: ObjectIdLike, sessionId: string, status: "CONNECTING" | "ACTIVE" | "ENDED", endReason?: SessionEndReason): Promise<import("mongoose").Document<unknown, {}, import("../models/session.js").ISession, {}, {}> & import("../models/session.js").ISession & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function incrementMessageCount(sessionId: Types.ObjectId | string): Promise<void>;
export {};
