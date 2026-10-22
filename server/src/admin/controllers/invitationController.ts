import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import * as invitationService from "../services/invitationService.js";
import { recordAudit } from "../../services/auditService.js";

const inviteSchema = z.object({
  name: z.string().min(1, "Staff name is required"),
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
});

export async function inviteStaffHandler(req: Request, res: Response): Promise<void> {
  const body = inviteSchema.parse(req.body);
  const result = await invitationService.createInvitation(req.auth!.orgId, req.auth!.sub, body, req);
  res.status(201).json({ invitation: result });
}

export async function acceptInvitationHandler(req: Request, res: Response): Promise<void> {
  const token = String(req.body.token ?? "").trim();
  if (!token) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: "Invitation token is required." } });
    return;
  }

  const result = await invitationService.acceptInvitation(token, req);
  recordAudit({
    action: "INVITE_ACCEPTED",
    organization: result.invitation.organization,
    actor: result.user?._id,
    target: result.invitation.user.toString(),
    req,
  });
  res.status(200).json({ invitation: { id: result.invitation._id, status: result.invitation.status } });
}
