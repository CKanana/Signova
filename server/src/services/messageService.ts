import { Message } from "../models/message.js";
import { Session } from "../models/session.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { logSessionEvent } from "./sessionService.js";
import { incrementMessageCount } from "./sessionService.js";
import type { Types } from "mongoose";
import type { MessageSender } from "../../../shared/types/translation.js";

export async function listMessages(orgId: Types.ObjectId | string, sessionId: string) {
  // Verify the session belongs to the org before returning messages.
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session not found");
  return Message.find({ session: sessionId, organization: orgId }).sort({ timestamp: 1 });
}

export async function sendMessage(
  orgId: Types.ObjectId | string,
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

  const message = await Message.create({
    session: sessionId,
    organization: orgId,
    sender: input.sender,
    text: input.text,
    method: input.method,
    confidence: input.confidence,
    isConfirmed: input.isConfirmed ?? false,
  });

  await incrementMessageCount(sessionId);
  await logSessionEvent(sessionId, orgId, input.sender === "USER" ? "message_sent" : "staff_replied", {
    method: input.method,
    ...(input.confidence !== undefined ? { confidence: input.confidence } : {}),
  });

  return message;
}
