import type { Request, Response } from "express";
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
export declare function resendInvitationHandler(req: Request, res: Response): Promise<void>;
/**
 * Accept a pending staff invitation token.
 *
 * Validates the token against the invitation store (unknown/expired/done
 * tokens throw BadRequestError), then atomically transitions the pending
 * invitation to `accepted` and returns the associated user + invitation.
 */
export declare function acceptInvitationHandler(req: Request, res: Response): Promise<void>;
/**
 * Create a new staff invitation + user (Gmail-only policy enforced).
 *
 * Handles the `/api/admin/staff/invite` route with `inviteLimiter` +
 * `requireAuth` + `requireRole("ADMIN")`. Applies the same Gmail-domain
 * policy as `adminService.createStaff`, creates the user and invitation,
 * sends the setup email, and records the `STAFF_CREATE` audit event.
 */
export declare function inviteStaffHandler(req: Request, res: Response): Promise<void>;
