import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { listMessages, sendMessage } from "../services/messageService.js";
import { paramId } from "../utils/params.js";
import { getIO } from "../realtime/gateway.js";
import { sessionRoom, S2C_STAFF, S2C_MOBILE, NAMESPACE } from "../realtime/events.js";
const sendSchema = z.object({
    sender: z.enum(["USER", "STAFF"]),
    text: z.string().min(1).max(2000),
    method: z.enum(["sign", "text", "speech"]),
    confidence: z.number().min(0).max(1).optional(),
    isConfirmed: z.boolean().optional(),
});
export const listMessagesHandler = async (req, res) => {
    const messages = await listMessages(req.auth.orgId, paramId(req));
    res.json({ messages });
};
export const sendMessageHandler = [
    validate({ body: sendSchema }),
    async (req, res) => {
        const message = await sendMessage(req.auth.orgId, paramId(req), req.body);
        // Broadcast to the session room so the other party receives it in real-time.
        // USER messages -> staff dashboard (message:new)
        // STAFF messages -> mobile app (staff:message)
        try {
            const io = getIO();
            const sessionId = paramId(req);
            const serialized = {
                id: message._id.toString(),
                sessionId,
                sender: message.sender,
                text: message.text,
                method: message.method,
                confidence: message.confidence,
                // Staff messages are persisted on the server before the broadcast.
                // Mark them isConfirmed=true for the staff sender's pending-send ack.
                // This lets the staff dashboard's client resolve its send promise as
                // soon as the server persists and rebroadcasts the message (the staff
                // socket is not in the session room, so its own message:new broadcast
                // would otherwise never reach it).
                isConfirmed: message.sender === "STAFF" ? true : message.isConfirmed,
                timestamp: message.timestamp.toISOString(),
            };
            // Broadcast to the session room so the other party receives it in
            // real-time. BOTH user messages and staff messages are emitted as
            // message:new so the staff dashboard (which listens for message:new)
            // sees user and its own staff messages. The mobile app listens for
            // staff:message to receive staff replies.
            const sessionRoomId = sessionRoom(sessionId);
            io.of(NAMESPACE).to(sessionRoomId).emit(S2C_STAFF.MESSAGE_NEW, serialized);
            if (message.sender === "STAFF") {
                io.of(NAMESPACE).to(sessionRoomId).emit(S2C_MOBILE.STAFF_MESSAGE, serialized);
            }
            // Also emit low-confidence alert to org tellers room if applicable
            if (message.sender === "USER" &&
                message.confidence !== undefined &&
                message.confidence < 0.6) {
                const { orgTellersRoom } = await import("../realtime/events.js");
                io.of(NAMESPACE)
                    .to(orgTellersRoom(String(req.auth.orgId)))
                    .emit(S2C_STAFF.TRANSLATION_LOW, {
                    sessionId,
                    confidence: message.confidence,
                });
            }
        }
        catch {
            // Non-fatal: REST response still succeeds even if realtime broadcast fails
        }
        res.status(201).json({ message });
    },
];
