import { Session } from "../models/session.js";
import { SessionLog } from "../models/sessionLog.js";
import { Teller } from "../models/teller.js";
import { User } from "../models/user.js";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "../utils/errors.js";
import { recordAudit } from "./auditService.js";
import type { Types } from "mongoose";
import type { CommunicationMethod, Role, SessionEndReason } from "../../../shared/types/translation.js";

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

/** Ticker-aware availability read: checks the DB + the live lease set.
 * A teller holding a pending request (RESERVED) counts as unavailable. */
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
 * Atomically reserve a teller for a new session request.
 *
 * The teller moves FREE → RESERVED (not BUSY): a reservation holds the
 * counter while the request awaits explicit acceptance, but the teller is
 * not yet in a session. The update condition `{ status: "FREE" }` means
 * the teller is only claimed if currently FREE — a single atomic MongoDB
 * operation, no read-then-write TOCTOU race. Returns the claimed teller
 * or null if another request won the race.
 */
export async function reserveTeller(
  orgId: ObjectIdLike,
  tellerId: ObjectIdLike
): Promise<import("../models/teller.js").ITeller | null> {
  return Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId, status: "FREE" },
    { $set: { status: "RESERVED" } },
    { new: true }
  );
}

/** Release a reserved teller back to FREE (conditional update). */
export async function releaseTeller(
  orgId: ObjectIdLike,
  tellerId: ObjectIdLike
): Promise<import("../models/teller.js").ITeller | null> {
  return Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId, status: "RESERVED" },
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
 * Create a new session request for a Deaf user pairing with a teller.
 *
 * The request is left pending (status CONNECTING) and the teller is
 * claimed RESERVED — not BUSY: the counter is held while the request
 * awaits explicit acceptance or rejection, but no session is in progress
 * yet. Reservation is atomic: a single findOneAndUpdate whose condition
 * requires status FREE. On failure the teller is released back to FREE
 * within the same function, so a rejected session never leaves the
 * teller stuck RESERVED. Live leases track the reservation in-process;
 * the authoritative state is the teller's status field in MongoDB.
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
    // teller permanently RESERVED.
    await releaseTeller(orgId, teller._id);
    releaseLease(sessionId);
    throw err;
  }
}

/**
 * Server-controlled acceptance of a pending session request.
 *
 * Preconditions (all enforced here, server-side):
 *  - the session exists and belongs to the organization;
 *  - the session's teller belongs to the same organization;
 *  - the actor is an ADMIN of the organization, or the STAFF user assigned
 *    to that teller (session.teller.staffUser === actor.sub);
 *  - the session is still pending (CONNECTING).
 *
 * Transition: session CONNECTING → ACTIVE, teller RESERVED → BUSY.
 * Idempotent: accepting an already-ACTIVE session is a no-op success.
 * Safe: accepting a CANCELLED or ENDED session is a conflict, not a
 * state change. An unrelated teller/staff member cannot accept another
 * teller's request.
 */
export async function acceptSession(
  orgId: ObjectIdLike,
  sessionId: string,
  actor: { role: Role; sub: string },
): Promise<import("../models/session.js").ISession> {
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session request not found");

  const teller = await Teller.findOne({ _id: session.teller, organization: orgId });
  if (!teller) throw new NotFoundError("Teller not found");

  if (actor.role === "STAFF") {
    if (!teller.staffUser || teller.staffUser.toString() !== actor.sub) {
      throw new ForbiddenError("You are not assigned to this teller's request");
    }
  } else if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only staff or administrators can accept session requests");
  }

  if (session.status === "ACTIVE") return session; // repeat accept is idempotent
  if (session.status === "CANCELLED" || session.status === "ENDED") {
    throw new ConflictError("Session request has already been resolved");
  }

  const activated = await Session.findOneAndUpdate(
    { _id: sessionId, organization: orgId, teller: teller._id, status: "CONNECTING" },
    { $set: { status: "ACTIVE" } },
    { new: true },
  );
  if (!activated) {
    // Lost the race or already resolved — re-read to report precisely.
    const current = await Session.findOne({ _id: sessionId, organization: orgId });
    if (!current) throw new NotFoundError("Session request not found");
    if (current.status === "ACTIVE") return current; // another acceptor won — idempotent
    throw new ConflictError("Session request is no longer pending");
  }

  const claimed = await Teller.findOneAndUpdate(
    { _id: teller._id, organization: orgId, status: "RESERVED" },
    { $set: { status: "BUSY" } },
    { new: true },
  );
  if (!claimed) {
    await logSessionEvent(session._id, orgId, "session_accepted", {
      warning: "teller reservation missing",
    });
    return activated;
  }

  await logSessionEvent(session._id, orgId, "session_accepted");
  return activated;
}

/**
 * Server-controlled rejection of a pending session request.
 *
 * Preconditions mirror acceptSession. Transition: session CONNECTING →
 * CANCELLED, teller RESERVED → FREE.
 * Idempotent: rejecting an already-CANCELLED session is a no-op success.
 * Safe: rejecting an ACTIVE or ENDED session is a conflict.
 */
export async function rejectSession(
  orgId: ObjectIdLike,
  sessionId: string,
  actor: { role: Role; sub: string },
): Promise<import("../models/session.js").ISession | null> {
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session request not found");

  const teller = await Teller.findOne({ _id: session.teller, organization: orgId });
  if (!teller) throw new NotFoundError("Teller not found");

  if (actor.role === "STAFF") {
    if (!teller.staffUser || teller.staffUser.toString() !== actor.sub) {
      throw new ForbiddenError("You are not assigned to this teller's request");
    }
  } else if (actor.role !== "ADMIN") {
    throw new ForbiddenError("Only staff or administrators can reject session requests");
  }

  if (session.status === "CANCELLED") return session; // repeat reject is idempotent
  if (session.status === "ACTIVE" || session.status === "ENDED") {
    throw new ConflictError("Cannot reject an active or ended session");
  }

  const cancelled = await Session.findOneAndUpdate(
    { _id: sessionId, organization: orgId, teller: teller._id, status: "CONNECTING" },
    { $set: { status: "CANCELLED" } },
    { new: true },
  );
  if (!cancelled) {
    const current = await Session.findOne({ _id: sessionId, organization: orgId });
    if (!current) throw new NotFoundError("Session request not found");
    if (current.status === "CANCELLED") return current; // another rejector won — idempotent
    throw new ConflictError("Session request is no longer pending");
  }

  await releaseTeller(orgId, teller._id);
  await logSessionEvent(session._id, orgId, "session_rejected");
  return cancelled;
}

export async function getCurrentSessionForDevice(orgId: ObjectIdLike, deviceId: string) {
  const deafUser = await User.findOne({ organization: orgId, role: "DEAF_USER", _id: deviceId });
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

/**
 * Reconcile teller statuses on server startup (or on-demand).
 *
 * Finds every teller marked BUSY or RESERVED that has no CONNECTING or
 * ACTIVE session, and resets them to FREE. This repairs any tellers stuck
 * BUSY/RESERVED due to crashes, ungraceful shutdowns, or missed
 * session:end / reject events. A teller with a live CONNECTING session is
 * left alone — its request is still pending.
 */
export async function reconcileStuckTellers(): Promise<number> {
  // Find all tellers currently marked BUSY or RESERVED.
  const busyTellers = await Teller.find({ status: { $in: ["BUSY", "RESERVED"] } })
    .select("_id organization")
    .lean();
  if (busyTellers.length === 0) return 0;

  const busyIds = busyTellers.map((t) => t._id);

  // Of those, find which ones actually have an active/connecting session.
  const activeSessions = await Session.find({
    teller: { $in: busyIds },
    status: { $in: ["CONNECTING", "ACTIVE"] },
  })
    .select("teller")
    .lean();

  const activeTellerIds = new Set(activeSessions.map((s) => s.teller.toString()));

  // Any BUSY/RESERVED teller with no live session is stuck — free them.
  const stuckIds = busyIds.filter((id) => !activeTellerIds.has(id.toString()));
  if (stuckIds.length === 0) return 0;

  await Teller.updateMany(
    { _id: { $in: stuckIds } },
    { $set: { status: "FREE" } },
  );

  // eslint-disable-next-line no-console
  console.log(`[reconcile] freed ${stuckIds.length} stuck teller(s): ${stuckIds.join(", ")}`);
  return stuckIds.length;
}
