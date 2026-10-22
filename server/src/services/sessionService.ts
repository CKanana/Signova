import { Session } from "../models/session.js";
import { SessionLog } from "../models/sessionLog.js";
import { Teller } from "../models/teller.js";
import { User } from "../models/user.js";
import { NotFoundError, BadRequestError, ConflictError } from "../utils/errors.js";
import { recordAudit } from "./auditService.js";
import type { Types } from "mongoose";
import type { CommunicationMethod, SessionEndReason } from "../../../shared/types/translation.js";

/** Accept both the mongoose runtime ObjectId and the schema-declared
 * Schema.Types.ObjectId, or a hex string. All three are valid _id values.
 */
type ObjectIdLike = Types.ObjectId | { toString(): string };

/** Process-local live-session registry.
 *
 * Mirrors the DB-level reservation so that a failed session creation
 * always releases the teller, and so that a concurrent availability
 * check cannot be re-run against a stale in-memory view.
 */
export const activeLeases = new Map<string, string>(); // sessionId -> tellerId

export function acquireLease(sessionId: string, tellerId: string): void {
  activeLeases.set(sessionId, tellerId);
}

export function releaseLease(sessionId: string): void {
  activeLeases.delete(sessionId);
}

/** Ticker-aware availability read: checks the DB + the live lease set. */
export async function tellerHasActiveSession(
  orgId: ObjectIdLike,
  tellerId: ObjectIdLike
): Promise<boolean> {
  const live = await Session.countDocuments({
    organization: orgId,
    teller: tellerId,
    status: { $in: ["CONNECTING", "ACTIVE"] },
  });
  return live > 0 || activeLeases.has(String(tellerId));
}

/**
 * Atomically reserve a teller for a new session.
 *
 * The update condition `{ status: "FREE" }` means the teller is only
 * claimed if it is currently FREE. Returns the claimed teller (status
 * BUSY) or null if the reservation failed because the teller is not
 * FREE (another request won the race). This is a single atomic
 * MongoDB operation — no read-then-write TOCTOU race.
 */
export async function reserveTeller(
  orgId: ObjectIdLike,
  tellerId: ObjectIdLike
): Promise<import("../models/teller.js").ITeller | null> {
  return Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId, status: "FREE" },
    { $set: { status: "BUSY" } },
    { new: true }
  );
}

/** Release a reserved teller back to FREE (conditional update). */
export async function releaseTeller(
  orgId: ObjectIdLike,
  tellerId: ObjectIdLike
): Promise<import("../models/teller.js").ITeller | null> {
  return Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId, status: "BUSY" },
    { $set: { status: "FREE" } },
    { new: true }
  );
}

/** Ensure a SessionLog exists for a session. */
export async function ensureSessionLog(sessionId: ObjectIdLike, orgId: ObjectIdLike) {
  const existing = await SessionLog.findOne({ session: sessionId });
  if (existing) return existing;
  return SessionLog.create({ session: sessionId, organization: orgId });
}

/** Append an event to the session log. */
export async function logSessionEvent(
  sessionId: ObjectIdLike,
  orgId: ObjectIdLike,
  type: string,
  meta?: Record<string, unknown>,
) {
  const log = await ensureSessionLog(sessionId, orgId);
  log.events.push({ type, at: new Date(), meta });
  await log.save();
  return log;
}

/** Record a translate latency sample. */
export async function recordLatency(sessionId: ObjectIdLike, orgId: ObjectIdLike, ms: number) {
  const log = await ensureSessionLog(sessionId, orgId);
  log.latencyMs.push(ms);
  await log.save();
}

/** Create or reuse a Deaf-user record linked to this device token. */
async function ensureDeafUser(orgId: ObjectIdLike, deviceId: string): Promise<ObjectIdLike> {
  const existing = await User.findOne({ organization: orgId, role: "DEAF_USER", phone: deviceId });
  if (existing) return existing._id;
  const created = await User.create({
    organization: orgId,
    role: "DEAF_USER",
    name: `Deaf user (${deviceId.slice(0, 6)})`,
    phone: deviceId,
  });
  return created._id;
}

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
export async function createSession(
  orgId: ObjectIdLike,
  input: { tellerId?: string; pairingCode?: string; method: CommunicationMethod; deviceId: string },
): Promise<import("../models/session.js").ISession> {
  let teller;
  if (input.tellerId) {
    teller = await Teller.findOne({ _id: input.tellerId, organization: orgId });
  } else if (input.pairingCode) {
    teller = await Teller.findOne({ organization: orgId, pairingCode: input.pairingCode.toUpperCase() });
  }
  if (!teller) throw new NotFoundError("Teller not found");

  const sessionId = new Session()._id.toString();

  // Reserve the teller atomically. If this returns null, another request
  // won the race and we exit without side effects.
  const claimed = await reserveTeller(orgId, teller._id);
  if (!claimed) {
    // Another request reserved this teller first; nothing was created.
    releaseLease(sessionId);
    throw new ConflictError("Teller is currently in a session");
  }
  acquireLease(sessionId, String(teller._id));

  try {
    const deafUserId = await ensureDeafUser(orgId, input.deviceId);

    const session = await Session.create({
      organization: orgId,
      teller: claimed._id,
      deafUser: deafUserId,
      method: input.method,
      status: "CONNECTING",
      pairingCode: claimed.pairingCode,
      messageCount: 0,
      isRecorded: true,
    });

    await ensureSessionLog(session._id, orgId);
    await logSessionEvent(session._id, orgId, "session_created", { method: input.method });
    return session;
  } catch (err) {
    // Roll back the reservation so a failed creation does not leave the
    // teller permanently BUSY.
    await releaseTeller(orgId, teller._id);
    releaseLease(sessionId);
    throw err;
  }
}

export async function getCurrentSessionForDevice(orgId: ObjectIdLike, deviceId: string) {
  const deafUser = await User.findOne({ organization: orgId, role: "DEAF_USER", phone: deviceId });
  if (!deafUser) return null;
  return Session.findOne({
    organization: orgId,
    deafUser: deafUser._id,
    status: { $in: ["CONNECTING", "ACTIVE"] },
  }).sort({ createdAt: -1 });
}

export async function getSessionById(orgId: ObjectIdLike, sessionId: string) {
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session not found");
  return session;
}

/** List sessions — staff see their teller's; admin sees the whole org. */
export async function listSessions(
  orgId: ObjectIdLike,
  opts: { tellerId?: string; status?: string; limit?: number } = {},
) {
  const filter: Record<string, unknown> = { organization: orgId };
  if (opts.tellerId) filter.teller = opts.tellerId;
  if (opts.status) filter.status = opts.status;
  return Session.find(filter).sort({ createdAt: -1 }).limit(opts.limit ?? 100);
}

/** Transition session status. On end, free the teller. */
export async function updateSessionStatus(
  orgId: ObjectIdLike,
  sessionId: string,
  status: "CONNECTING" | "ACTIVE" | "ENDED",
  endReason?: SessionEndReason,
) {
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session not found");

  if (status === "ENDED") {
    session.status = "ENDED";
    session.endedAt = new Date();
    session.endReason = endReason ?? "USER_ENDED";

    // Free the teller.
    await Teller.updateOne({ _id: session.teller }, { $set: { status: "FREE" } });

    // Finalize the session log stats.
    const log = await ensureSessionLog(session._id, orgId);
    const start = session.startedAt.getTime();
    const end = session.endedAt.getTime();
    log.stats.durationMs = end - start;
    if (log.latencyMs.length > 0) {
      log.stats.avgConfidence = log.events
        .filter((e) => e.type === "translation_confirmed" && typeof e.meta?.confidence === "number")
        .reduce((s, e) => s + (e.meta!.confidence as number), 0) /
        Math.max(1, log.events.filter((e) => e.type === "translation_confirmed").length);
    }
    log.events.push({ type: "session_ended", at: new Date(), meta: { reason: session.endReason } });
    await log.save();
  } else {
    session.status = status;
    await logSessionEvent(session._id, orgId, `session_${status.toLowerCase()}`);
  }

  await session.save();
  return session;
}

export async function incrementMessageCount(sessionId: Types.ObjectId | string) {
  await Session.updateOne({ _id: sessionId }, { $inc: { messageCount: 1 } });
}
