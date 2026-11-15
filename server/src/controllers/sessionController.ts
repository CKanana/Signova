import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { NotFoundError, ForbiddenError } from "../utils/errors.js";
import {
  createSession,
  acceptSession,
  rejectSession,
  getCurrentSessionForDevice,
  getSessionById,
  listSessions,
  updateSessionStatus,
} from "../services/sessionService.js";
import { emitSessionRequest, emitSessionActive, emitSessionRejected, emitSessionEnded } from "../realtime/gateway.js";
import { Session } from "../models/session.js";
import { Teller } from "../models/teller.js";
import { paramId } from "../utils/params.js";
import type { Role, SessionEndReason } from "../../../shared/types/translation.js";

const createSchema = z.object({
  tellerId: z.string().optional(),
  pairingCode: z.string().optional(),
  method: z.enum(["sign", "text"]),
}).refine((d) => d.tellerId || d.pairingCode, {
  message: "Either tellerId or pairingCode is required",
});

const statusSchema = z.object({
  status: z.enum(["CONNECTING", "ACTIVE", "ENDED"]),
  endReason: z.enum(["USER_ENDED", "STAFF_ENDED", "TIMEOUT", "ERROR"]).optional(),
});

export const createSessionHandler = [
  validate({ body: createSchema }),
  async (req: Request, res: Response): Promise<void> => {
    // Mobile device token carries the device identity in `sub`.
    const deviceId = req.auth!.sub;
    const session = await createSession(req.auth!.orgId, {
      tellerId: req.body.tellerId,
      pairingCode: req.body.pairingCode,
      method: req.body.method,
      deviceId,
    });
    await emitSessionRequest(req.auth!.orgId, session);
    res.status(201).json({ session });
  },
];

export const currentSessionHandler = async (req: Request, res: Response): Promise<void> => {
  const session = await getCurrentSessionForDevice(req.auth!.orgId, req.auth!.sub);
  res.json({ session });
};

export const getSessionHandler = async (req: Request, res: Response): Promise<void> => {
  const session = await getSessionById(req.auth!.orgId, paramId(req));
  res.json({ session });
};

export const listSessionsHandler = async (req: Request, res: Response): Promise<void> => {
  const sessions = await listSessions(req.auth!.orgId, {
    tellerId: req.query.tellerId as string | undefined,
    status: req.query.status as string | undefined,
  });
  res.json({ sessions });
};

export const updateSessionStatusHandler = [
  validate({ body: statusSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const session = await updateSessionStatus(
      req.auth!.orgId,
      paramId(req),
      req.body.status,
      req.body.endReason as SessionEndReason | undefined,
    );
    if (req.body.status === "ENDED") {
      await emitSessionEnded(req.auth!.orgId, session);
    }
    res.json({ session });
  },
];

const idParamSchema = z.object({ id: z.string().min(1) });

type SessionActor = { role: Role; sub: string };

function actorOf(req: Request): SessionActor {
  if (!req.auth) throw new Error("UNAUTHENTICATED");
  return { role: req.auth.role, sub: req.auth.sub };
}

export const acceptSessionHandler = [
  validate({ params: idParamSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const session = await Session.findOne({
      _id: paramId(req),
      organization: req.auth!.orgId,
    });
    if (!session) throw new NotFoundError("Session request not found");

    const teller = await Teller.findOne({
      _id: session.teller,
      organization: req.auth!.orgId,
    });
    if (!teller) throw new NotFoundError("Teller not found");

    const actor = actorOf(req);
    if (actor.role === "STAFF") {
      if (!teller.staffUser || teller.staffUser.toString() !== actor.sub) {
        throw new ForbiddenError("You are not assigned to this teller's request");
      }
    } else if (actor.role !== "ADMIN") {
      throw new ForbiddenError("Only staff or administrators can accept session requests");
    }

    const accepted = await acceptSession(req.auth!.orgId, session._id.toString(), actor);
    await emitSessionActive(req.auth!.orgId, accepted, teller.staffUser?.toString());
    res.json({ session: accepted });
  },
];

export const rejectSessionHandler = [
  validate({ params: idParamSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const session = await Session.findOne({
      _id: paramId(req),
      organization: req.auth!.orgId,
    });
    if (!session) throw new NotFoundError("Session request not found");

    const teller = await Teller.findOne({
      _id: session.teller,
      organization: req.auth!.orgId,
    });
    if (!teller) throw new NotFoundError("Teller not found");

    const actor = actorOf(req);
    if (actor.role === "STAFF") {
      if (!teller.staffUser || teller.staffUser.toString() !== actor.sub) {
        throw new ForbiddenError("You are not assigned to this teller's request");
      }
    } else if (actor.role !== "ADMIN") {
      throw new ForbiddenError("Only staff or administrators can reject session requests");
    }

    const cancelled = await rejectSession(req.auth!.orgId, session._id.toString(), actor);
    await emitSessionRejected(req.auth!.orgId, cancelled!);
    res.json({ session: cancelled });
  },
];
