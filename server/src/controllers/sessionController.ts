import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import {
  createSession,
  getCurrentSessionForDevice,
  getSessionById,
  listSessions,
  updateSessionStatus,
} from "../services/sessionService.js";
import { emitSessionRequest } from "../realtime/gateway.js";
import { paramId } from "../utils/params.js";
import type { SessionEndReason } from "../../../shared/types/translation.js";

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
    res.json({ session });
  },
];
