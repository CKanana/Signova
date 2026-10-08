import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { createSession } from "../services/sessionService.js";
import { resolveKioskOrganization } from "../services/kioskService.js";
import { emitSessionRequest } from "../realtime/gateway.js";
import { signAccessToken } from "../utils/jwt.js";
import { Teller } from "../models/teller.js";
import type { CommunicationMethod } from "../../../shared/types/translation.js";

const createSchema = z.object({
  tellerId: z.string().optional(),
  pairingCode: z.string().optional(),
  method: z.enum(["sign", "text"]),
  deviceId: z.string().min(8, "deviceId required"),
}).refine((d) => d.tellerId || d.pairingCode, {
  message: "Either tellerId or pairingCode is required",
});

/**
 * PUBLIC (unauthenticated) session creation for the mobile kiosk.
 *
 * A Deaf-user device has no login, so this endpoint resolves the kiosk org,
 * creates the session against the chosen teller, and returns a short-lived
 * DEAF_USER access token bound to the device's Deaf-user identity. The mobile
 * app uses that token for all subsequent session-scoped calls (messages,
 * translate, socket). The backend remains the source of truth for teller
 * availability — if the teller is BUSY, createSession throws 409 and the
 * mobile UI must handle it.
 */
export const publicCreateSessionHandler = [
  validate({ body: createSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const org = await resolveKioskOrganization();
    const session = await createSession(org._id, {
      tellerId: req.body.tellerId,
      pairingCode: req.body.pairingCode,
      method: req.body.method as CommunicationMethod,
      deviceId: req.body.deviceId,
    });

    // Issue a device-scoped access token for this Deaf user.
    const accessToken = signAccessToken({
      sub: session.deafUser.toString(),
      orgId: org._id.toString(),
      role: "DEAF_USER",
    });

    // Notify staff dashboards of the incoming session request.
    await emitSessionRequest(org._id.toString(), session);

    const teller = await Teller.findById(session.teller);
    res.status(201).json({ session, accessToken, teller });
  },
];
