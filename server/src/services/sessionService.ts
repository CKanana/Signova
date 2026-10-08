import { Session } from "../models/session.js";
import { SessionLog } from "../models/sessionLog.js";
import { Teller } from "../models/teller.js";
import { User } from "../models/user.js";
import { NotFoundError, BadRequestError, ConflictError } from "../utils/errors.js";
import { recordAudit } from "./auditService.js";
import type { Types } from "mongoose";
import type { CommunicationMethod, SessionEndReason } from "../../../shared/types/translation.js";

/**
 * Accept both the mongoose runtime ObjectId and the schema-declared
 * Schema.Types.ObjectId, or a hex string. All three are valid _id values.
 */
type ObjectIdLike = Types.ObjectId | { toString(): string };

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
 * Marks the teller BUSY and emits (via realtime layer) a session:request.
 */
export async function createSession(
  orgId: ObjectIdLike,
  input: { tellerId?: string; pairingCode?: string; method: CommunicationMethod; deviceId: string },
) {
  let teller;
  if (input.tellerId) {
    teller = await Teller.findOne({ _id: input.tellerId, organization: orgId });
  } else if (input.pairingCode) {
    teller = await Teller.findOne({ organization: orgId, pairingCode: input.pairingCode.toUpperCase() });
  }
  if (!teller) throw new NotFoundError("Teller not found");
  if (teller.status === "BUSY") throw new ConflictError("Teller is currently in a session");

  const deafUserId = await ensureDeafUser(orgId, input.deviceId);

  const session = await Session.create({
    organization: orgId,
    teller: teller._id,
    deafUser: deafUserId,
    method: input.method,
    status: "CONNECTING",
    pairingCode: teller.pairingCode,
    messageCount: 0,
    isRecorded: true,
  });

  teller.status = "BUSY";
  await teller.save();

  await ensureSessionLog(session._id, orgId);
  await logSessionEvent(session._id, orgId, "session_created", { method: input.method });

  return session;
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

/** Transition session status. On end, free the teller and finalize the log. */
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
    await Teller.updateOne({ _id: session.teller }, { status: "FREE" });

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
