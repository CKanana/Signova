import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import {
  listTellers,
  getTeller,
  createTeller,
  updateTeller,
  updateTellerAvailability,
} from "../services/tellerService.js";
import { recordAudit } from "../services/auditService.js";
import { paramId } from "../utils/params.js";

const createSchema = z.object({
  name: z.string().min(1),
  serviceLabel: z.string().optional(),
  serviceDesk: z.string().min(1),
  counterNumber: z.string().min(1),
  staffUser: z.string().optional(),
  pairingCode: z.string().min(4).max(8),
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  serviceLabel: z.string().optional(),
  serviceDesk: z.string().min(1).optional(),
  counterNumber: z.string().min(1).optional(),
  staffUser: z.string().optional(),
});

const availabilitySchema = z.object({
  status: z.enum(["FREE", "BUSY", "OFFLINE"]),
});

export const listTellersHandler = async (req: Request, res: Response): Promise<void> => {
  const tellers = await listTellers(req.auth!.orgId);
  res.json({ tellers });
};

export const getTellerHandler = async (req: Request, res: Response): Promise<void> => {
  const teller = await getTeller(req.auth!.orgId, paramId(req));
  res.json({ teller });
};

export const createTellerHandler = [
  validate({ body: createSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const teller = await createTeller(req.auth!.orgId, req.body);
    await recordAudit({ action: "TELLER_CREATE", actor: req.auth!.sub, organization: req.auth!.orgId, target: teller._id.toString(), req });
    res.status(201).json({ teller });
  },
];

export const updateTellerHandler = [
  validate({ body: updateSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const teller = await updateTeller(req.auth!.orgId, paramId(req), req.body);
    await recordAudit({ action: "TELLER_UPDATE", actor: req.auth!.sub, organization: req.auth!.orgId, target: paramId(req), req });
    res.json({ teller });
  },
];

export const availabilityHandler = [
  validate({ body: availabilitySchema }),
  async (req: Request, res: Response): Promise<void> => {
    const teller = await updateTellerAvailability(req.auth!.orgId, paramId(req), req.body.status);
    res.json({ teller });
  },
];
