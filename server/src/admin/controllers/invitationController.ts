import type { Request, Response } from "express";
import { z } from "zod";
import { resendInvitation } from "../services/invitationService.js";
import { acceptInvitation } from "../services/invitationService.js";
import { recordAudit } from "../../services/auditService.js";
import { BadRequestError, NotFoundError } from "../../utils/errors.js";
import { User } from "../../models/user.js";
import * as adminService from "../services/adminService.js";

/** Input shape for resending a staff invitation setup email. */
const resendSchema = z.object({
  email: z.string().email().toLowerCase(),
});

/**
 * Resend the setup email for a pending staff invitation.
 *
 * Reasoning: this endpoint is registered in the admin router under
 * `/api/admin/staff/invite/resend` with `requireAuth` + `requireRole("ADMIN")`,
 * so org-scoping and role authorization happen there. This controller is a
 * thin gateway: it validates the payload, calls the service (which enforces
 * the pending-invitation source-of-truth and cross-org guards), and returns
 * the real outcome.
 *
 * The email is only regarded as "sent" once `sendMail` returns truthy;
 * otherwise the created invitation is rolled back and a 400 is returned.
 *
 * Guards:
 *  - no 2FA reset, no account unlock, no security-flag changes;
 *  - recipient already accepted invite → no resend; no probing unknown emails;
 *  - rate-limited via `inviteLimiter` middleware and/or `inviteResendCooldownMs`.
 */
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
    await recordAudit({
      action: isNotFound ? "INVITE_ACCEPTED" : "INVITE_EMAIL_FAILED",
      organization: String(organization),
      actor,
      target: body.email,
      req,
      error: err?.message,
    });
    const status = isNotFound ? 404 : isBadRequest ? 400 : 500;
    res.status(status).json({ error: err?.message ?? "Failed to resend invitation email." });
  }
}

/**
 * Accept a pending staff invitation token.
 *
 * Validates the token against the invitation store (unknown/expired/done
 * tokens throw BadRequestError), then atomically transitions the pending
 * invitation to `accepted` and returns the associated user + invitation.
 */
export async function acceptInvitationHandler(req: Request, res: Response): Promise<void> {
  const token = (req.body as { token?: string })?.token;
  if (!token) {
    await recordAudit({ action: "INVITE_ACCEPT_UNKNOWN_TOKEN", organization: String(req.auth?.orgId ?? ""), target: "", req });
    res.status(400).json({ error: "Missing invitation token." });
    return;
  }
  try {
    const result = await acceptInvitation(token, req);
    res.status(200).json({ invitation: result });
  } catch (err: any) {
    await recordAudit({ action: "INVITE_ACCEPT_FAILED", organization: String(req.auth?.orgId ?? ""), target: token, req, error: err?.message });
    res.status(500).json({ error: "Failed to accept invitation." });
  }
}

/**
 * Create a new staff invitation + user (Gmail-only policy enforced).
 *
 * Handles the `/api/admin/staff/invite` route with `inviteLimiter` +
 * `requireAuth` + `requireRole("ADMIN")`. Applies the same Gmail-domain
 * policy as `adminService.createStaff`, creates the user and invitation,
 * sends the setup email, and records the `STAFF_CREATE` audit event.
 */
export async function inviteStaffHandler(req: Request, res: Response): Promise<void> {
  const body = z
    .object({
      name: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      role: z.enum(["STAFF", "ADMIN"]),
    })
    .parse(req.body);

  const organization = req.auth!.orgId;
  const actor = req.auth!.sub;

  // Reject duplicate email.
  const existing = await User.findOne({
    organization: organization,
    email: body.email.toLowerCase(),
  });
  if (existing) {
    await recordAudit({ action: "STAFF_INVITE_DUPLICATE", organization: String(organization), actor, target: body.email, req });
    res.status(409).json({ error: "An account with this email already exists" });
    return;
  }

  // Admins may only create other admins when an existing admin is present.
  if (body.role === "ADMIN") {
    const existingAdmin = await User.findOne({
      organization: organization,
      role: "ADMIN",
      _id: { $ne: actor },
    });
    if (!existingAdmin) {
      await recordAudit({ action: "STAFF_INVITE_NO_ADMIN_PRIVILEGE", organization: String(organization), actor, target: body.email, req });
      res.status(403).json({ error: "Only an existing administrator can create another administrator" });
      return;
    }
  }

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
    const isConflict = err instanceof NotFoundError;
    res.status(isBadRequest ? 400 : isConflict ? 404 : 500).json({ error: err?.message ?? "Failed to create staff invitation." });
  }
}
