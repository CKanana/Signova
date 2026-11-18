import type { Server, Socket } from "socket.io";
import type { AccessTokenPayload } from "../utils/jwt.js";
import {
  C2S,
  NAMESPACE,
  sessionRoom,
  orgTellersRoom,
  userRoom,
  S2C_MOBILE,
  S2C_STAFF,
  S2C_STAFF_FROM_SENDER,
} from "./events.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { NotFoundError, ForbiddenError } from "../utils/errors.js";
import {
  getSessionById,
  acceptSession,
  rejectSession,
  updateSessionStatus,
  logSessionEvent,
} from "../services/sessionService.js";
import { sendMessage, enqueueAnimationJob } from "../services/messageService.js";
import { emitSessionActive, emitSessionRejected } from "./gateway.js";
import { Teller } from "../models/teller.js";

/**
 * Register Socket.IO event handlers for an authenticated socket.
 * Every handler re-checks organization ownership server-side — a client can
 * never act on another organization's session, even with a valid token.
 */
export function registerSocketHandlers(io: Server, socket: Socket & { auth?: AccessTokenPayload }) {
  const auth = socket.auth;
  if (!auth) {
    socket.disconnect(true);
    return;
  }

  // Staff/admin join their org's teller room to receive session requests.
  // They also join their personal user room so targeted notifications reach
  // only them (e.g. session requests for their assigned teller).
  if (auth.role === "STAFF" || auth.role === "ADMIN") {
    socket.join(orgTellersRoom(auth.orgId));
    socket.join(userRoom(auth.sub));
  }

  socket.on(C2S.SESSION_JOIN, async (payload: { sessionId: string }) => {
    try {
      const session = await getSessionById(auth.orgId, payload.sessionId);
      // A device may only join its own session; staff may join sessions for their org.
      const isOwner = auth.role === "DEAF_USER"
        ? session.deafUser.toString() === auth.sub
        : true;
      if (!isOwner) throw new ForbiddenError("Not your session");

      socket.join(sessionRoom(session._id.toString()));

      // The Deaf user joining the socket room does NOT promote the session:
      // CONNECTING → ACTIVE happens only when an authorized teller accepts
      // the request server-side (POST /api/sessions/:id/accept).
      socket.emit(S2C_MOBILE.SESSION_CONNECTED, {
        sessionId: session._id.toString(),
        status: session.status,
      });
    } catch (err) {
      socket.emit(S2C_MOBILE.ERROR, { message: (err as Error).message });
    }
  });

  socket.on(C2S.SESSION_ACCEPT, async (payload: { sessionId: string }, ack?: (res: { ok: boolean; sessionId?: string; status?: string; error?: string }) => void) => {
    try {
      const session = await getSessionById(auth.orgId, payload.sessionId);
      const teller = await Teller.findOne({
        _id: session.teller,
        organization: auth.orgId,
      });
      if (!teller) throw new NotFoundError("Teller not found");

      if (auth.role === "STAFF") {
        if (!teller.staffUser || teller.staffUser.toString() !== auth.sub) {
          throw new ForbiddenError("You are not assigned to this teller's request");
        }
      } else if (auth.role !== "ADMIN") {
        throw new ForbiddenError("Only staff or administrators can accept session requests");
      }

      const accepted = await acceptSession(auth.orgId, session._id.toString(), {
        role: auth.role,
        sub: auth.sub,
      });

      await emitSessionActive(auth.orgId, accepted, teller.staffUser?.toString());
      socket.emit(S2C_STAFF.SESSION_ACTIVE, {
        sessionId: accepted._id.toString(),
        status: "ACTIVE",
      });
      ack?.({ ok: true, sessionId: accepted._id.toString(), status: "ACTIVE" });
    } catch (err) {
      const message = (err as Error).message;
      socket.emit(S2C_MOBILE.ERROR, { message });
      ack?.({ ok: false, error: message });
    }
  });

  socket.on(C2S.SESSION_REJECT, async (payload: { sessionId: string }, ack?: (res: { ok: boolean; sessionId?: string; status?: string; error?: string }) => void) => {
    try {
      const session = await getSessionById(auth.orgId, payload.sessionId);
      const teller = await Teller.findOne({
        _id: session.teller,
        organization: auth.orgId,
      });
      if (!teller) throw new NotFoundError("Teller not found");

      if (auth.role === "STAFF") {
        if (!teller.staffUser || teller.staffUser.toString() !== auth.sub) {
          throw new ForbiddenError("You are not assigned to this teller's request");
        }
      } else if (auth.role !== "ADMIN") {
        throw new ForbiddenError("Only staff or administrators can reject session requests");
      }

      const cancelled = await rejectSession(auth.orgId, session._id.toString(), {
        role: auth.role,
        sub: auth.sub,
      });

      await emitSessionRejected(auth.orgId, cancelled!);
      socket.emit(S2C_STAFF.SESSION_ACTIVE, {
        sessionId: cancelled!._id.toString(),
        status: "CANCELLED",
      });
      ack?.({ ok: true, sessionId: cancelled!._id.toString(), status: "CANCELLED" });
    } catch (err) {
      const message = (err as Error).message;
      socket.emit(S2C_MOBILE.ERROR, { message });
      ack?.({ ok: false, error: message });
    }
  });

  socket.on(C2S.MESSAGE_SEND, async (payload: {
    sessionId: string;
    text: string;
    method: "sign" | "text" | "speech";
    confidence?: number;
    isConfirmed?: boolean;
  }, ack?: (res: { ok: boolean; messageId?: string; sender?: string; error?: string }) => void) => {
    try {
      const session = await getSessionById(auth.orgId, payload.sessionId);
      const sender = auth.role === "DEAF_USER" ? "USER" : "STAFF";
      const message = await sendMessage(auth.orgId, session._id.toString(), {
        sender,
        text: payload.text,
        method: payload.method,
        confidence: payload.confidence,
        isConfirmed: payload.isConfirmed,
      });

      // Broadcast to the session room so the Deaf user receives staff messages
      // in real-time. Staff-facing new-message events go to the org tellers
      // room since staff sockets are not in individual session rooms.
      const sessionRoomId = sessionRoom(session._id.toString());
      const messagePayload = serializeMessage(message);
      if (message.sender === "STAFF") {
        io.of(NAMESPACE).to(sessionRoomId).emit(S2C_MOBILE.STAFF_MESSAGE, messagePayload);
      }
      io.of(NAMESPACE).to(orgTellersRoom(auth.orgId)).emit(S2C_STAFF.MESSAGE_NEW, messagePayload);
      if (message.sender === "USER" && payload.confidence !== undefined && payload.confidence < 0.6) {
        io.of(NAMESPACE).to(orgTellersRoom(auth.orgId)).emit(S2C_STAFF.TRANSLATION_LOW, {
          sessionId: session._id.toString(),
          confidence: payload.confidence,
        });
      }

      if (message.sender === "STAFF" && message.animation?.status === "pending") {
        void enqueueAnimationJob(
          message._id.toString(),
          session._id.toString(),
          message.text,
        );
      }

      const ackRes: { ok: boolean; messageId: string; sender: string; isConfirmed: boolean } = {
        ok: true,
        messageId: message._id.toString(),
        sender: message.sender,
        isConfirmed: message.sender === "STAFF" ? true : (payload.isConfirmed ?? false),
      };
      // Emit legacy events for any listeners that still use them.
      if (ackRes.isConfirmed) {
        socket.emit(S2C_STAFF_FROM_SENDER.MESSAGE_ACKED, ackRes);
      } else {
        socket.emit(S2C_STAFF_FROM_SENDER.MESSAGE_REJECTED, ackRes);
      }
      // Resolve the sender's awaited promise.
      ack?.(ackRes);
    } catch (err) {
      const message = (err as Error).message;
      socket.emit(S2C_MOBILE.ERROR, { message });
      ack?.({ ok: false, error: message });
    }
  });

  socket.on(C2S.SESSION_END, async (payload: { sessionId: string; reason?: string }) => {
    try {
      const session = await getSessionById(auth.orgId, payload.sessionId);
      const reason = auth.role === "DEAF_USER" ? "USER_ENDED" : "STAFF_ENDED";
      await updateSessionStatus(auth.orgId, session._id.toString(), "ENDED", reason as never);

      // Notify all session participants (deaf user + staff in the room)
      io.of(NAMESPACE).to(sessionRoom(session._id.toString())).emit(S2C_MOBILE.SESSION_ENDED, {
        sessionId: session._id.toString(),
        summary: { messageCount: session.messageCount },
      });

      // Notify the org tellers room so staff dashboards see the teller go FREE
      io.of(NAMESPACE).to(orgTellersRoom(auth.orgId)).emit(S2C_STAFF.SESSION_ENDED, {
        sessionId: session._id.toString(),
        tellerId: session.teller.toString(),
      });
    } catch (err) {
      socket.emit(S2C_MOBILE.ERROR, { message: (err as Error).message });
    }
  });
}

function serializeAnimation(m: any) {
  const a = m.animation;
  if (!a) return null;
  return {
    status: a.status,
    url: a.url ?? null,
    durationMs: a.durationMs ?? null,
    requestedAt: a.requestedAt ? new Date(a.requestedAt).toISOString() : null,
    readyAt: a.readyAt ? new Date(a.readyAt).toISOString() : null,
    error: a.error ?? null,
  };
}

function serializeMessage(m: any) {
  return {
    id: m._id.toString(),
    sessionId: m.session.toString(),
    sender: m.sender,
    text: m.text,
    method: m.method,
    confidence: m.confidence,
    isConfirmed: m.isConfirmed,
    timestamp: m.timestamp.toISOString(),
    animation: serializeAnimation(m),
  };
}
