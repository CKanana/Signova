import type { Request, Response } from "express";
import { z } from "zod";
import { resendInvitation, acceptInvitation } from "../services/invitationService.js";
import { recordAudit } from "../../services/auditService.js";
import { BadRequestError, NotFoundError, ConflictError, ForbiddenError } from "../../utils/errors.js";
import * as adminService from "../services/adminService.js";
import { Invitation } from "../../models/invitation.js";
import { User } from "../../models/user.js";
import { signAccessToken } from "../../utils/jwt.js";

/** Input shape for resending a staff invitation setup email. */
const resendSchema = z.object({
  email: z.string().email().toLowerCase(),
});

export async function resendInvitationHandler(req: Request, res: Response): Promise<void> {
  const body = resendSchema.parse(req.body);
  const organization = req.auth!.orgId;
  const actor = req.auth!.sub;

  try {
    const result = await resendInvitation(organization, actor, body.email, req);
    res.status(200).json({ invitation: result });
  } catch (err: any) {
    const isNotFound = err instanceof NotFoundError;
    const isBadRequest = err instanceof BadRequestError;
    const isConflict = err instanceof ConflictError;

    await recordAudit({
      action: isNotFound ? "INVITE_EMAIL_FAILED" : (isBadRequest ? "INVITE_EMAIL_FAILED" : "INVITE_ACCEPT_FAILED"),
      organization: String(organization),
      actor,
      target: body.email,
      req,
      error: err?.message,
    });

    const status = isNotFound ? 404 : isConflict ? 409 : isBadRequest ? 400 : 500;
    res.status(status).json({
      error: {
        code: isNotFound ? "NOT_FOUND" : isConflict ? "CONFLICT" : isBadRequest ? "BAD_REQUEST" : "INTERNAL_ERROR",
        message: err?.message ?? "Failed to resend invitation email.",
      },
    });
  }
}

export async function acceptInvitationHandler(req: Request, res: Response): Promise<void> {
  const token = (req.body as { token?: string })?.token;
  const password = (req.body as { password?: string })?.password;
  if (!token) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Missing invitation token." } });
    return;
  }
  try {
    const result = await acceptInvitation(token, password, req);
    res.status(200).json(result);
  } catch (err: any) {
    const isBadRequest = err instanceof BadRequestError;
    const isConflict = err instanceof NotFoundError;
    const status = isBadRequest ? 400 : isConflict ? 404 : 500;
    res.status(status).json({
      error: {
        code: isBadRequest ? "BAD_REQUEST" : "INTERNAL_ERROR",
        message: err?.message ?? "Failed to accept invitation.",
      },
    });
  }
}

export async function acceptInvitationByIdHandler(req: Request, res: Response): Promise<void> {
  const invitationId = req.params.invitationId;
  const orgId = req.body?.orgId;
  if (!invitationId) {
    res.status(400).json({ error: { code: "BAD_REQUEST", message: "Invitation ID is required." } });
    return;
  }
  try {
    const invitation = await Invitation.findById(invitationId);
    if (!invitation) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "Invitation not found." } });
      return;
    }
    const user = await User.findById(invitation.user);
    if (!user) {
      res.status(404).json({ error: { code: "NOT_FOUND", message: "User not found." } });
      return;
    }
    invitation.status = "accepted";
    invitation.acceptedAt = new Date();
    await invitation.save();

    user.isActive = true;
    await user.save();

    const targetOrgId = orgId && orgId !== "org-a"
      ? orgId.toString()
      : user.organization.toString();

    const accessToken = signAccessToken({
      sub: user._id.toString(),
      orgId: targetOrgId,
      role: user.role,
    });

    res.status(200).json({
      accessToken,
      user,
      invitation,
    });
  } catch (err: any) {
    res.status(500).json({ error: { code: "INTERNAL_ERROR", message: err?.message ?? "Failed to accept invitation." } });
  }
}

export async function inviteStaffHandler(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      role: z.enum(["STAFF", "ADMIN"]).default("STAFF"),
    })
    .parse(req.body);

  const organization = req.auth!.orgId;
  const actor = req.auth!.sub;

  try {
    const { user, invitation } = await adminService.createStaff(organization, body, actor, req);
    res.status(201).json({
      staff: user,
      invitation: invitation
        ? {
            id: invitation.id,
            name: invitation.name,
            email: invitation.email,
            role: invitation.role,
            invitationId: invitation.invitationId,
            expiresAt: invitation.expiresAt,
          }
        : null,
    });
  } catch (err: any) {
    await recordAudit({ action: "STAFF_INVITE_FAILED", organization: String(organization), actor, target: body.email, req, error: err?.message });
    const isBadRequest = err instanceof BadRequestError;
    const isConflict = err instanceof ConflictError;
    const isNotFound = err instanceof NotFoundError;
    const isForbidden = err instanceof ForbiddenError;
    res.status(isForbidden ? 403 : isBadRequest ? 400 : isConflict ? 409 : isNotFound ? 404 : 500).json({
      error: {
        code: isForbidden ? "FORBIDDEN" : isBadRequest ? "BAD_REQUEST" : isConflict ? "CONFLICT" : isNotFound ? "NOT_FOUND" : "INTERNAL_ERROR",
        message: err?.message ?? "Failed to create staff invitation.",
      },
    });
  }
}

