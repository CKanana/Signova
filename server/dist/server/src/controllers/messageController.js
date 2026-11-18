import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { listMessages, sendMessage, enqueueAnimationJob, pruneOldVideos, resolveVideoPath, } from "../services/messageService.js";
import { paramId } from "../utils/params.js";
import { getIO } from "../realtime/gateway.js";
import { sessionRoom, S2C_STAFF, S2C_MOBILE, NAMESPACE, orgTellersRoom } from "../realtime/events.js";
import { Message } from "../models/message.js";
import fs from "node:fs";
const sendSchema = z.object({
    sender: z.enum(["USER", "STAFF"]),
    text: z.string().min(1).max(2000),
    method: z.enum(["sign", "text", "speech"]),
    confidence: z.number().min(0).max(1).optional(),
    isConfirmed: z.boolean().optional(),
});
function serializeAnimation(m) {
    const a = m.animation;
    if (!a)
        return null;
    return {
        status: a.status,
        url: a.url ?? null,
        durationMs: a.durationMs ?? null,
        requestedAt: a.requestedAt ? a.requestedAt.toISOString() : null,
        readyAt: a.readyAt ? a.readyAt.toISOString() : null,
        error: a.error ?? null,
    };
}
function serializeMessage(m) {
    return {
        id: m._id.toString(),
        sessionId: m.session.toString(),
        sender: m.sender,
        text: m.text,
        method: m.method,
        confidence: m.confidence,
        isConfirmed: m.sender === "STAFF" ? true : m.isConfirmed,
        timestamp: m.timestamp.toISOString(),
        animation: serializeAnimation(m),
    };
}
export const listMessagesHandler = async (req, res) => {
    const messages = (await listMessages(req.auth.orgId, paramId(req)));
    res.json({ messages: messages.map((m) => ({ ...m.toJSON(), animation: serializeAnimation(m) })) });
};
export const sendMessageHandler = [
    validate({ body: sendSchema }),
    async (req, res) => {
        const orgId = req.auth.orgId;
        const sessionId = paramId(req);
        // Persist immediately (animation initialised to "pending" when eligible).
        const message = await sendMessage(orgId, sessionId, req.body);
        const msg = message;
        // Broadcast the text message immediately — never blocked by generation.
        try {
            const io = getIO();
            const serialized = serializeMessage(msg);
            const sessionRoomId = sessionRoom(sessionId);
            io.of(NAMESPACE).to(sessionRoomId).emit(S2C_STAFF.MESSAGE_NEW, serialized);
            if (msg.sender === "STAFF") {
                io.of(NAMESPACE).to(sessionRoomId).emit(S2C_MOBILE.STAFF_MESSAGE, serialized);
            }
            if (msg.sender === "USER" &&
                msg.confidence !== undefined &&
                msg.confidence < 0.6) {
                io.of(NAMESPACE).to(orgTellersRoom(String(orgId))).emit(S2C_STAFF.TRANSLATION_LOW, {
                    sessionId,
                    confidence: msg.confidence,
                });
            }
        }
        catch {
            // Non-fatal: REST response still succeeds even if realtime broadcast fails.
        }
        // Async animation generation (never blocks delivery). Fire-and-forget.
        if (msg.animation?.status === "pending") {
            void enqueueAnimationJob(msg._id.toString(), sessionId, msg.text);
        }
        res.status(201).json({ message: msg });
    },
];
// ---------------------------------------------------------------------------
// Animation streaming (session-scoped, unguessable, not public)
// ---------------------------------------------------------------------------
const MP4_MEDIA_TYPE = "video/mp4";
function streamFile(filePath, start, end) {
    const size = fs.statSync(filePath).size;
    const chunkSize = end - start + 1;
    const stream = fs.createReadStream(filePath, { start, end, highWaterMark: 1024 * 1024 });
    stream.on("open", () => { });
    return stream;
}
export const animationStreamHandler = async (req, res) => {
    const sessionId = paramId(req);
    const messageId = paramId(req, "messageId");
    const message = (await Message.findOne({ _id: messageId }));
    if (!message) {
        res.status(404).json({ error: "Animation not found" });
        return;
    }
    if (message.session.toString() !== sessionId || message.sender !== "STAFF") {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    const a = message.animation;
    if (!a || a.status !== "ready" || !a.url) {
        res.status(404).json({ error: "Animation not ready" });
        return;
    }
    const filePath = resolveVideoPath(messageId);
    if (!filePath) {
        res.status(404).json({ error: "Video file not found" });
        return;
    }
    if (!fs.existsSync(filePath)) {
        res.status(404).json({ error: "Video file not found on disk" });
        return;
    }
    const stat = fs.statSync(filePath);
    const range = req.headers.range;
    if (range) {
        const parts = range.replace(/bytes=/, "").split("-");
        const start = parts[0] ? parseInt(parts[0], 10) : 0;
        const end = parts[1] ? parseInt(parts[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        const stream = streamFile(filePath, start, end);
        res.writeHead(206, {
            "Content-Type": MP4_MEDIA_TYPE,
            "Content-Range": `bytes ${start}-${end}/${stat.size}`,
            "Content-Length": chunkSize,
            "Accept-Ranges": "bytes",
            "Cache-Control": "public, max-age=3600",
        });
        stream.pipe(res);
        return;
    }
    res.writeHead(200, {
        "Content-Type": MP4_MEDIA_TYPE,
        "Content-Length": stat.size,
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=3600",
    });
    fs.createReadStream(filePath).pipe(res);
};
// ---------------------------------------------------------------------------
// Manual retry + status
// ---------------------------------------------------------------------------
export const retryAnimationHandler = async (req, res) => {
    const sessionId = paramId(req);
    const messageId = paramId(req, "messageId");
    const message = (await Message.findOne({ _id: messageId }));
    if (!message) {
        res.status(404).json({ error: "Message not found" });
        return;
    }
    if (message.session.toString() !== sessionId) {
        res.status(403).json({ error: "Forbidden" });
        return;
    }
    const a = message.animation;
    const retryable = !a || ["failed", "retry", "pending", "skipped"].includes(a?.status ?? "");
    if (!retryable) {
        res.status(409).json({ error: `Cannot retry animation with status "${a?.status}"` });
        return;
    }
    const text = message.text;
    if (!text.trim()) {
        message.animation = { status: "skipped", url: null, durationMs: null, requestedAt: null, readyAt: null, error: null };
        await message.save();
        res.json({ message });
        return;
    }
    message.animation = { status: "retry", url: null, durationMs: null, requestedAt: new Date(), readyAt: null, error: null };
    await message.save();
    void enqueueAnimationJob(messageId, sessionId, text);
    res.json({ message, queued: true, hint: "message:animation will be emitted when complete" });
};
// ---------------------------------------------------------------------------
// Startup health probe + periodic retention cleanup (scheduled)
// ---------------------------------------------------------------------------
export async function probeAnimationServiceWrapper() {
    const { probeAnimationService } = await import("../services/messageService.js");
    return probeAnimationService();
}
export { pruneOldVideos };
