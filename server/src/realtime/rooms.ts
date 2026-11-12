import type { Server, Socket } from "socket.io";
import type { AccessTokenPayload } from "../utils/jwt.js";
import { C2S, sessionRoom, orgTellersRoom, userRoom, S2C_MOBILE, S2C_STAFF, S2C_STAFF_FROM_SENDER } from "./events.js";
import { Session } from "../models/session.js";
import { User } from "../models/user.js";
import { NotFoundError, ForbiddenError } from "../utils/errors.js";
import {
  getSessionById,
  updateSessionStatus,
  logSessionEvent,
} from "../services/sessionService.js";
import { sendMessage } from "../services/messageService.js";

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

      if (auth.role === "DEAF_USER" && session.status === "CONNECTING") {
        await updateSessionStatus(auth.orgId, session._id.toString(), "ACTIVE");
        // Notify staff room that the session is live.
        io.to(orgTellersRoom(auth.orgId)).emit(S2C_STAFF.SESSION_ACTIVE, {
          sessionId: session._id.toString(),
        });
      }

      socket.emit(S2C_MOBILE.SESSION_CONNECTED, {
        sessionId: session._id.toString(),
        status: session.status,
      });
    } catch (err) {
      socket.emit(S2C_MOBILE.ERROR, { message: (err as Error).message });
    }
  });

  socket.on(C2S.MESSAGE_SEND, async (payload: {
    sessionId: string;
    text: string;
    method: "sign" | "text" | "speech";
    confidence?: number;
    isConfirmed?: boolean;
  }) => {
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

      // Broadcast to the session room so the *other* party receives it in
      // real-time. A staff socket is never in the session room (it holds no
      // session socket), so the staff dashboard does NOT see its own staff
      // message here. Mobile receives STAFF messages via staff:message.
      const sessionRoomId = sessionRoom(session._id.toString());
      const messagePayload = serializeMessage(message);
      io.to(sessionRoomId).emit(S2C_STAFF.MESSAGE_NEW, messagePayload);
      if (message.sender === "STAFF") {
        io.to(sessionRoomId).emit(S2C_MOBILE.STAFF_MESSAGE, messagePayload);
      }
      if (message.sender === "USER" && payload.confidence !== undefined && payload.confidence < 0.6) {
        io.to(orgTellersRoom(auth.orgId)).emit(S2C_STAFF.TRANSLATION_LOW, {
          sessionId: session._id.toString(),
          confidence: payload.confidence,
        });
      }

      // Direct ack to the sender socket. The sender's own emit is handled
      // *before* the room broadcast, so this event loop completes and the
      // server can resolve the staff dashboard's send promise. Sending the
      // ack after broadcast ensures it is enqueued behind any message:new /
      // staff:message packets the sender will see.
      const ack = {
        ...messagePayload,
        isConfirmed: message.sender === "STAFF" ? true : (payload.isConfirmed ?? false),
      };
      if (ack.isConfirmed) {
        socket.emit(S2C_STAFF_FROM_SENDER.MESSAGE_ACKED, ack);
      } else {
        socket.emit(S2C_STAFF_FROM_SENDER.MESSAGE_REJECTED, ack);
      }
    } catch (err) {
      socket.emit(S2C_MOBILE.ERROR, { message: (err as Error).message });
    }
  });

  socket.on(C2S.SESSION_END, async (payload: { sessionId: string; reason?: string }) => {
    try {
      const session = await getSessionById(auth.orgId, payload.sessionId);
      const reason = auth.role === "DEAF_USER" ? "USER_ENDED" : "STAFF_ENDED";
      await updateSessionStatus(auth.orgId, session._id.toString(), "ENDED", reason as never);

      // Notify all session participants (deaf user + staff in the room)
      io.to(sessionRoom(session._id.toString())).emit(S2C_MOBILE.SESSION_ENDED, {
        sessionId: session._id.toString(),
        summary: { messageCount: session.messageCount },
      });

      // Notify the org tellers room so staff dashboards see the teller go FREE
      io.to(orgTellersRoom(auth.orgId)).emit(S2C_STAFF.SESSION_ENDED, {
        sessionId: session._id.toString(),
        tellerId: session.teller.toString(),
      });
    } catch (err) {
      socket.emit(S2C_MOBILE.ERROR, { message: (err as Error).message });
    }
  });
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
  };
}
