import { Message } from "../models/message.js";
import { Session } from "../models/session.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { logSessionEvent, incrementMessageCount } from "./sessionService.js";
import { config } from "../config/env.js";
import type { MessageSender } from "../../../shared/types/translation.js";
import type { IMessage } from "../models/message.js";
import type { IAnimation } from "../models/message.js";
import type { Model } from "mongoose";
import { sessionRoom, S2C_MOBILE } from "../realtime/events.js";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Typed model handle (avoids Mongoose overload "not callable" under strict TS). */
const Msg = Message as unknown as Model<IMessage>;

/**
 * Text-to-ASL animation service (SignBridge) integration.
 *
 * Phase 2 design:
 *  - The teller types English; the existing Node backend persists and emits
 *    the text message immediately (never blocked by generation).
 *  - After the message is saved, an in-process job queue enqueues a SignBridge
 *    animation generation request against the standalone FastAPI service
 *    (signbridge-service). The queue is capped (concurrency 1-2) because
 *    rendering is CPU-heavy, and has a small retry with backoff.
 *  - On success the backend stores the MP4 locally, serves it through a
 *    session-scoped streaming route, sets status "ready", and emits
 *    "message:animation" to the session room.
 *  - On failure/timeout/circuit-open the status is "failed"; the original text
 *    is still delivered and visible.
 *  - Identical (normalised) text reuses the existing MP4 (cache) instead of
 *    regenerating, and old files are cleaned up on a configurable retention.
 *  - The Deaf-user PWA never talks to the Python service directly — it gets
 *    the video URL through the existing Socket.IO workflow.
 */

const signbridgeEnabled = config.signbridgeEnabled;
const signbridgeUrl = config.signbridgeUrl;
const signbridgeTimeoutMs = config.signbridgeTimeoutMs;
const signbridgeMaxChars = config.signbridgeMaxChars;
const signbridgeVideoRetentionSeconds = config.signbridgeVideoRetentionSeconds;
const signbridgeCircuitCooldownSeconds = config.signbridgeCircuitCooldownSeconds;

const ANIMATION_SERVICE_URL = signbridgeEnabled ? signbridgeUrl : "";
const ANIMATION_TIMEOUT_MS = signbridgeTimeoutMs;
const ANIMATION_MAX_CHARS = signbridgeMaxChars;
const VIDEO_RETENTION_SECONDS = signbridgeVideoRetentionSeconds;
const CIRCUIT_COOLDOWN_MS = signbridgeCircuitCooldownSeconds * 1000;

// ---------------------------------------------------------------------------
// Local MP4 storage (session-scoped, unguessable; never the Python service
// filesystem path exposed to the client).
// ---------------------------------------------------------------------------
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VIDEO_STORAGE_DIR = path.resolve(__dirname, "..", "storage", "videos");
fs.mkdirSync(VIDEO_STORAGE_DIR, { recursive: true });

/** In-memory map: messageId -> absolute filesystem path of the stored MP4. */
const messageVideoPath = new Map<string, string>();

/** Cache: normalised text -> { filePath, durationMs } for identical-text reuse. */
const animationCache = new Map<string, { filePath: string; durationMs: number }>();

/**
 * Deterministic on-disk location for a message's MP4.
 *
 * The stream route resolves files by message id, so storing the file under a
 * stable name lets a restarted server (which loses the in-memory map) keep
 * serving animations that were generated before the restart.
 */
function messageVideoFile(messageId: string): string {
  return path.join(VIDEO_STORAGE_DIR, `${messageId}.mp4`);
}

function normaliseText(text: string): string {
  return text.trim().toLowerCase();
}

/** Verify the session belongs to the org and return its messages. */
export async function listMessages(orgId: string, sessionId: string) {
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session not found");
  return Msg.find({ session: sessionId, organization: orgId }).sort({ timestamp: 1 });
}

/** Persist a message and return it (animation initialised by initialAnimation). */
export async function sendMessage(
  orgId: string,
  sessionId: string,
  input: {
    sender: MessageSender;
    text: string;
    method: "sign" | "text" | "speech";
    confidence?: number;
    isConfirmed?: boolean;
  },
) {
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session not found");
  if (session.status === "ENDED") throw new BadRequestError("Session has ended");

  const message = await Msg.create({
    session: sessionId,
    organization: orgId,
    sender: input.sender,
    text: input.text,
    method: input.method,
    confidence: input.confidence,
    isConfirmed: input.isConfirmed ?? false,
    animation: initialAnimation(input.sender, input.text),
  });
  await incrementMessageCount(sessionId);
  await logSessionEvent(sessionId, orgId, input.sender === "USER" ? "message_sent" : "staff_replied", {
    method: input.method,
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
  });
  return message;
}

/** Does this message need an animation at all? (skip = no video generated). */
export function needsAnimation(sender: MessageSender, text: string): boolean {
  if (sender !== "STAFF") return false;
  const trimmed = text.trim();
  if (!trimmed) return false;
  if (trimmed.length > ANIMATION_MAX_CHARS) return false;
  return true;
}

function animationSkeleton(error: string | null): IAnimation {
  return {
    status: "pending",
    url: null,
    durationMs: null,
    requestedAt: new Date(),
    readyAt: null,
    error,
  };
}

function failedAnimation(error: string): IAnimation {
  return {
    status: "failed",
    url: null,
    durationMs: null,
    requestedAt: new Date(),
    readyAt: null,
    error,
  };
}

function skippedAnimation(error: string | null): IAnimation {
  return {
    status: "skipped",
    url: null,
    durationMs: null,
    requestedAt: new Date(),
    readyAt: null,
    error,
  };
}

/** Initial animation state for a newly created staff message. */
export function initialAnimation(sender: MessageSender, text: string): IAnimation | null {
  if (sender !== "STAFF") return null;
  const trimmed = text.trim();
  if (!trimmed) return skippedAnimation("empty");
  if (trimmed.length > ANIMATION_MAX_CHARS) return skippedAnimation("too_long");
  if (!signbridgeEnabled) return skippedAnimation("service_disabled");
  return animationSkeleton(null);
}

/**
 * Persist the animation status on a message. Emits "message:animation" to the
 * session room so the Deaf-user PWA can react (never blocks the caller).
 */
export async function setAnimationStatus(
  messageId: string,
  sessionId: string,
  animation: Partial<IAnimation> & { status: IAnimation["status"] },
): Promise<void> {
  const message = await Msg.findOne({ _id: messageId });
  if (!message) return;
  const prev = message.animation;
  const next: IAnimation = {
    status: animation.status,
    url: animation.url ?? (prev?.url ?? null),
    durationMs: animation.durationMs ?? (prev?.durationMs ?? null),
    requestedAt: animation.requestedAt ?? (prev?.requestedAt ?? null),
    readyAt: animation.readyAt ?? (prev?.readyAt ?? null),
    error: animation.error ?? (prev?.error ?? null),
  };
  if (next.status === "ready") next.readyAt = next.readyAt ?? new Date();
  message.animation = next;
  await message.save();

  // Emit status change to the session room (lazy import to avoid import cycles).
  void (async () => {
    try {
      const { getIO } = await import("../realtime/gateway.js");
      const io = getIO();
      io.of("/signova").to(sessionRoom(sessionId)).emit(S2C_MOBILE.MESSAGE_ANIMATION, {
        sessionId,
        messageId,
        status: next.status,
        url: next.url ?? null,
        durationMs: next.durationMs ?? null,
        requestedAt: next.requestedAt ? next.requestedAt.toISOString() : null,
        readyAt: next.readyAt ? next.readyAt.toISOString() : null,
        error: next.error ?? null,
      });
    } catch {
      // Socket emission is best-effort; history reload still carries the field.
    }
  })();
}

// ---------------------------------------------------------------------------
// In-process job queue (concurrency 1-2, bounded retry with backoff)
// ---------------------------------------------------------------------------

interface QueueItem {
  messageId: string;
  sessionId: string;
  text: string;
  attempts: number;
  status: "queued" | "processing" | "completed" | "failed";
}

const MAX_CONCURRENCY = 2;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1500;

let queue: QueueItem[] = [];
let running = 0;
let circuitOpen = false;
let circuitOpenedAt = 0;

function isCircuitOpen(): boolean {
  if (!circuitOpen) return false;
  if (Date.now() - circuitOpenedAt >= CIRCUIT_COOLDOWN_MS) {
    circuitOpen = false;
    return false;
  }
  return true;
}

function openCircuit(): void {
  circuitOpen = true;
  circuitOpenedAt = Date.now();
}

function closeCircuit(): void {
  circuitOpen = false;
  circuitOpenedAt = 0;
}

function peekNext(): QueueItem | null {
  return queue.find((q) => q.status === "queued") ?? null;
}

function processQueue(): void {
  while (running < MAX_CONCURRENCY) {
    const item = peekNext();
    if (!item) return;
    const idx = queue.indexOf(item);
    if (idx === -1) return;
    queue[idx] = { ...item, status: "processing" };
    running++;
    void runAnimationJob(queue[idx]);
  }
}

async function runAnimationJob(item: QueueItem): Promise<void> {
  const { messageId, sessionId, text } = item;

  // Circuit open -> skip gracefully.
  if (isCircuitOpen()) {
    await setAnimationStatus(messageId, sessionId, {
      status: "failed",
      error: "animation_service_unavailable",
    });
    running = Math.max(0, running - 1);
    queue = queue.filter((x) => x !== item);
    processQueue();
    return;
  }

  // Empty / too-long / non-staff -> skipped (defensive; caller pre-filters).
  if (!needsAnimation("STAFF", text)) {
    await setAnimationStatus(messageId, sessionId, {
      status: "skipped",
      error: !text.trim() ? "empty" : "not_eligible",
    });
    running = Math.max(0, running - 1);
    queue = queue.filter((x) => x !== item);
    processQueue();
    return;
  }

  // --- Cache hit: identical normalised text reuses existing MP4 -------------
  const key = normaliseText(text);
  const hit = animationCache.get(key);
  if (hit) {
    if (fs.existsSync(hit.filePath)) {
      // Copy into this message's stable file so it survives a cache eviction
      // of the original message and can be resolved after a server restart.
      const target = messageVideoFile(messageId);
      try {
        fs.copyFileSync(hit.filePath, target);
        messageVideoPath.set(messageId, target);
        await setAnimationStatus(messageId, sessionId, {
          status: "ready",
          url: `/api/sessions/${sessionId}/messages/${messageId}/animation`,
          durationMs: hit.durationMs,
        });
        running = Math.max(0, running - 1);
        queue = queue.filter((x) => x !== item);
        processQueue();
        return;
      } catch {
        // Fall through to a fresh render if the cached file cannot be copied.
      }
    }
    animationCache.delete(key);
  }

  // --- Call the SignBridge service -----------------------------------------
  let arrayBuffer: ArrayBuffer | null = null;
  let durationMs: number | null = null;
  let serviceError: string | null = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), ANIMATION_TIMEOUT_MS);
    const res = await fetch(`${ANIMATION_SERVICE_URL}/v1/animations`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!res.ok) {
      serviceError = `signbridge returned ${res.status}`;
    } else if (res.headers.get("content-type")?.includes("video/mp4")) {
      arrayBuffer = await res.arrayBuffer();
      const raw = res.headers.get("X-SignBridge-Duration-Sec");
      durationMs = raw ? Math.round(parseFloat(raw) * 1000) : null;
    } else {
      serviceError = `unexpected content type ${res.headers.get("content-type")}`;
    }
  } catch (err) {
    serviceError = (err as Error).message;
  }

  if (arrayBuffer) {
    // Success: store the MP4 locally under a deterministic, non-guessable
    // per-message name so the stream route can resolve it after a restart.
    fs.mkdirSync(VIDEO_STORAGE_DIR, { recursive: true });
    const filePath = messageVideoFile(messageId);
    fs.writeFileSync(filePath, Buffer.from(arrayBuffer));
    messageVideoPath.set(messageId, filePath);
    animationCache.set(key, { filePath, durationMs: durationMs ?? 0 });
    closeCircuit();
    await setAnimationStatus(messageId, sessionId, {
      status: "ready",
      url: `/api/sessions/${sessionId}/messages/${messageId}/animation`,
      durationMs,
    });
    running = Math.max(0, running - 1);
    queue = queue.filter((x) => x !== item);
    processQueue();
    return;
  }

  // --- Failure path: retry with backoff, then open circuit -----------------
  const nextBackoff = Math.min(INITIAL_BACKOFF_MS * 2 ** (item.attempts - 1), 30_000);
  if (item.attempts < MAX_RETRIES) {
    item.attempts += 1;
    queue.push({ ...item, status: "queued" } as QueueItem);
    setTimeout(() => processQueue(), nextBackoff);
    running = Math.max(0, running - 1);
    queue = queue.filter((x) => x !== item);
    processQueue();
    return;
  }

  // Exhausted retries -> fail and open the circuit so we stop calling.
  openCircuit();
  await setAnimationStatus(messageId, sessionId, {
    status: "failed",
    error: serviceError ?? "animation_generation_failed",
  });
  running = Math.max(0, running - 1);
  queue = queue.filter((x) => x !== item);
  processQueue();
}

/** Enqueue a message for animation generation (non-blocking, fire-and-forget). */
export function enqueueAnimationJob(messageId: string, sessionId: string, text: string): void {
  if (!signbridgeEnabled) return;
  if (!needsAnimation("STAFF", text)) return;
  queue.push({ messageId, sessionId, text, attempts: 1, status: "queued" });
  processQueue();
}

/**
 * Re-enqueue staff messages whose animation was still pending/retrying when
 * the process last stopped. The queue is in-memory only, so without this a
 * restart would leave those messages stuck on "pending" forever.
 */
export async function requeuePendingAnimations(): Promise<number> {
  if (!signbridgeEnabled) return 0;
  const stuck = await Msg.find({
    sender: "STAFF",
    "animation.status": { $in: ["pending", "retry"] },
  })
    .select("_id session text")
    .lean()
    .exec();
  let count = 0;
  for (const m of stuck as Array<{ _id: unknown; session: unknown; text: string }>) {
    if (!needsAnimation("STAFF", m.text ?? "")) continue;
    enqueueAnimationJob(String(m._id), String(m.session), m.text);
    count += 1;
  }
  return count;
}

// ---------------------------------------------------------------------------
// Circuit breaker + health
// ---------------------------------------------------------------------------

export function checkCircuit(): boolean {
  return !isCircuitOpen();
}

export function openCircuitManually(): void {
  openCircuit();
}

export function closeCircuitManually(): void {
  closeCircuit();
}

export function queueSnapshot(): { running: number; queued: number; circuitOpen: boolean } {
  return { running, queued: queue.filter((q) => q.status === "queued").length, circuitOpen: isCircuitOpen() };
}

// ---------------------------------------------------------------------------
// Cache: identical normalised text reuses existing MP4
// ---------------------------------------------------------------------------

/** Find an existing ready animation for this session (cache hit). */
export async function findCachedAnimation(sessionId: string): Promise<{ url: string; durationMs: number } | null> {
  const messages = await Msg.find({ session: sessionId }).sort({ timestamp: 1 });
  for (const m of messages) {
    const a = (m as IMessage).animation;
    if (a && a.status === "ready" && a.url) {
      return { url: a.url, durationMs: a.durationMs ?? 0 };
    }
  }
  return null;
}

/** Register a completed animation's path so the stream route can serve it. */
export function registerVideoPath(messageId: string, filePath: string): void {
  messageVideoPath.set(messageId, filePath);
}

/** Resolve the local filesystem path for a message's animation (stream route). */
export function resolveVideoPath(messageId: string): string | undefined {
  const known = messageVideoPath.get(messageId);
  if (known) return known;
  // A restarted server starts with an empty map: recover the stable file.
  const recovered = messageVideoFile(messageId);
  if (fs.existsSync(recovered)) {
    messageVideoPath.set(messageId, recovered);
    return recovered;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Video cleanup (retention, default 7 days)
// ---------------------------------------------------------------------------

/** Delete videos older than VIDEO_RETENTION_SECONDS and mark messages skipped. */
export async function pruneOldVideos(): Promise<number> {
  if (VIDEO_RETENTION_SECONDS <= 0) return 0;
  const cutoff = new Date(Date.now() - VIDEO_RETENTION_SECONDS * 1000);
  const expired = await Msg.find({
    "animation.url": { $exists: true, $ne: null },
    "animation.readyAt": { $lt: cutoff },
    "animation.status": "ready",
  });
  let removed = 0;
  for (const m of expired) {
    const a = m.animation as IAnimation | null;
    if (!a) continue;
    const filePath = a.url ? resolveVideoPath(m._id.toString()) : undefined;
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch { /* already gone */ }
      messageVideoPath.delete(m._id.toString());
      removed++;
    }
    a.status = "skipped";
    a.url = null;
    a.durationMs = null;
    a.readyAt = null;
    a.error = "file expired (retention)";
    await m.save();
  }
  return removed;
}

// ---------------------------------------------------------------------------
// Health probe + circuit breaker startup (wired in server/index.ts)
// ---------------------------------------------------------------------------

export async function probeAnimationService(): Promise<"up" | "down" | "disabled"> {
  if (!ANIMATION_SERVICE_URL) return "disabled";
  try {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), ANIMATION_TIMEOUT_MS);
    const res = await fetch(`${ANIMATION_SERVICE_URL}/health`, { signal: controller.signal });
    clearTimeout(t);
    return res.ok ? "up" : "down";
  } catch {
    return "down";
  }
}

export function startCircuitBreaker(): void {
  (async () => {
    const state = await probeAnimationService();
    if (state === "down") openCircuit();
    // Poll periodically and recover when the service comes back.
    setInterval(async () => {
      const state = await probeAnimationService();
      if (state === "up") closeCircuit();
      else openCircuit();
    }, 30_000).unref();
  })();
}
