import { Organization } from "../../models/organization.js";
import { User } from "../../models/user.js";
import { Invitation } from "../../models/invitation.js";
import { recordAudit } from "../../services/auditService.js";
import { randomToken, hashToken } from "../../utils/crypto.js";
import { sendMail, buildInvitationEmail, buildInvitationUrl } from "../../services/mailService.js";
import type { Types } from "mongoose";
import type { Role } from "../../../../shared/types/translation.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { assertPasswordPolicy } from "../../utils/passwordPolicy.js";
import { hashPassword } from "../../services/tokenService.js";
import { signChallengeToken } from "../../utils/jwt.js";

const INVITE_TOKEN_BYTES = 32;
const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000;

/** Input shape for creating a new staff invitation. */
export interface CreateInvitationInput {
  name: string;
  email: string;
  phone?: string;
  role?: Role;
}

/** Shape returned by createInvitation. */
export interface InvitationResult {
  id: string;
  name: string;
  email: string;
  role: Role;
  invitationId: string;
  expiresAt: Date;
  user?: any;
  invitation?: any;
}

export async function createInvitation(
  orgId: string | Types.ObjectId,
  invitedBy: string | Types.ObjectId,
  data: CreateInvitationInput,
  req: import("express").Request
): Promise<InvitationResult> {
  const org = await Organization.findById(orgId);
  if (!org) throw new NotFoundError("Organization not found");

  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();

  if (!email || !name) {
    throw new BadRequestError("Staff name and email are required.");
  }

  if (org.restrictRegistrationByDomain) {
    const domain = email.split("@")[1]?.toLowerCase();
    const allowed = (org.allowedEmailDomains ?? []).map((d) => d.toLowerCase());
    if (!domain || !allowed.includes(domain)) {
      throw new ForbiddenError("Email domain is not allowed for this organization.");
    }
  }

  const existingUser = await User.findOne({
    organization: orgId,
    email,
  });

  if (existingUser) {
    throw new ConflictError("An account with this email already exists in this organization.");
  }

  const pendingInvitation = await Invitation.findOne({
    organization: orgId,
    email,
    status: "pending",
    expiresAt: { $gt: new Date() },
  });

  if (pendingInvitation) {
    throw new ConflictError("An account with this email already exists in this organization.");
  }

  const rawToken = randomToken(INVITE_TOKEN_BYTES);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  let user: any;
  let invitation: any;

  try {
    user = await User.create({
      organization: orgId,
      role: data.role ?? "STAFF",
      name,
      email,
      phone: data.phone,
      twoFactorEnabled: false,
      isActive: false,
    });

    invitation = await Invitation.create({
      user: user._id,
      email,
      organization: orgId,
      invitedBy,
      tokenHash,
      status: "pending",
      expiresAt,
    });

    const invitationUrl = buildInvitationUrl(rawToken);
    const emailPayload = buildInvitationEmail(name, invitationUrl, expiresAt);
    const sent = await sendMail({
      to: email,
      subject: emailPayload.subject,
      text: emailPayload.text,
      html: emailPayload.html,
    });

    if (!sent) {
      await User.deleteOne({ _id: user._id });
      await Invitation.deleteOne({ _id: invitation._id });
      await recordAudit({ action: "INVITE_EMAIL_FAILED", organization: String(orgId), actor: String(invitedBy), target: email, req });
      throw new BadRequestError("Invitation email could not be sent. Please try again later.");
    }
  } catch (err) {
    const isRetryable =
      err instanceof BadRequestError ||
      err instanceof ForbiddenError ||
      err instanceof ConflictError;

    if (!isRetryable) {
      if (user) await User.deleteOne({ _id: user._id });
      if (invitation) await Invitation.deleteOne({ _id: invitation._id });
      await recordAudit({ action: "INVITE_EMAIL_FAILED", organization: String(orgId), actor: String(invitedBy), target: email, req });
    }

    throw err;
  }

  await recordAudit({ action: "INVITE_CREATED", organization: String(orgId), actor: String(invitedBy), target: user._id.toString(), req });

  if (!invitation) {
    throw new Error("Expected invitation to be created");
  }

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    invitationId: invitation._id.toString(),
    expiresAt: (invitation as { expiresAt: Date }).expiresAt,
    user,
    invitation,
  };
}

export async function acceptInvitation(
  rawToken: string,
  passwordOrReq?: string | import("express").Request,
  reqMaybe?: import("express").Request,
) {
  let password: string | undefined;
  let req: import("express").Request | undefined;

  if (typeof passwordOrReq === "string") {
    password = passwordOrReq;
    req = reqMaybe;
  } else if (passwordOrReq && typeof passwordOrReq === "object") {
    req = passwordOrReq as import("express").Request;
  }

  const tokenHash = hashToken(rawToken);
  const invitation = await Invitation.findOne({ tokenHash });

  if (!invitation) {
    await recordAudit({ action: "INVITE_ACCEPT_UNKNOWN_TOKEN", organization: undefined, target: "", req });
    throw new BadRequestError("Invitation token is invalid or expired.");
  }

  if (invitation.status !== "pending") {
    await recordAudit({ action: "INVITE_ACCEPT_REPLAY", organization: String(invitation.organization), target: invitation.user.toString(), req });
    throw new BadRequestError("Invitation token is invalid or expired.");
  }

  if (invitation.expiresAt.getTime() <= Date.now()) {
    invitation.status = "expired";
    await invitation.save();
    await recordAudit({ action: "INVITE_ACCEPT_EXPIRED", organization: String(invitation.organization), target: invitation.user.toString(), req });
    throw new BadRequestError("Invitation token is invalid or expired.");
  }

  const user = await User.findById(invitation.user).select("+passwordHash");
  if (!user || !user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    await recordAudit({ action: "INVITE_ACCEPT_BAD_USER", organization: String(invitation.organization), target: invitation.user.toString(), req });
    throw new BadRequestError("Invitation token is invalid or expired.");
  }

  if (password && typeof password === "string") {
    assertPasswordPolicy(password);
  }

  const updated = await Invitation.findOneAndUpdate(
    { _id: invitation._id, status: "pending" },
    { $set: { status: "accepted", acceptedAt: new Date() } },
    { new: true },
  );

  if (!updated) {
    await recordAudit({ action: "INVITE_ACCEPT_REPLAY", organization: String(invitation.organization), target: invitation.user.toString(), req });
    throw new BadRequestError("Invitation token is invalid or expired.");
  }

  if (password && typeof password === "string") {
    user.passwordHash = await hashPassword(password);
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    await user.save();

    const challengeToken = signChallengeToken(user._id.toString(), "mfa_enroll");

    await recordAudit({
      action: "INVITE_ACCEPTED",
      organization: String(user.organization),
      actor: user._id,
      target: user._id.toString(),
      req,
    });

    return {
      status: "mfa_enroll_required",
      challengeToken,
      user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, _id: user._id },
      invitation: updated,
    };
  }

  return {
    user,
    invitation: updated,
  };
}

/** Re-send the setup email for a staff invitation. */
export async function resendInvitation(
  orgId: string | Types.ObjectId,
  userId: string,
  email: string,
  req: import("express").Request,
) {
  const org = await Organization.findById(orgId);
  if (!org) throw new NotFoundError("Organization not found.");

  const normalizedEmail = email.trim().toLowerCase();
  const user = await User.findOne({ organization: orgId, email: normalizedEmail }).select("+passwordHash");
  if (!user) {
    throw new NotFoundError("Staff member not found in this organization.");
  }

  // If the user has already completed full onboarding (has password and 2FA),
  // they should sign in directly or use forgot-password.
  if (user.passwordHash && user.twoFactorEnabled) {
    throw new ConflictError("This account has already completed setup and activated. They can sign in directly.");
  }

  // Supersede/expire any existing pending invitations for this staff member
  await Invitation.updateMany(
    { organization: orgId, user: user._id, status: "pending" },
    { $set: { status: "expired" } },
  );

  const rawToken = randomToken(INVITE_TOKEN_BYTES);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);

  const newInvitation = await Invitation.create({
    user: user._id,
    email: normalizedEmail,
    organization: orgId,
    invitedBy: userId,
    tokenHash,
    status: "pending",
    expiresAt,
  });

  const invitationUrl = buildInvitationUrl(rawToken);
  const emailPayload = buildInvitationEmail(user.name, invitationUrl, expiresAt);
  const sent = await sendMail({
    to: normalizedEmail,
    subject: emailPayload.subject,
    text: emailPayload.text,
    html: emailPayload.html,
  });

  if (!sent) {
    await Invitation.deleteOne({ _id: newInvitation._id });
    await recordAudit({ action: "INVITE_EMAIL_FAILED", organization: String(orgId), actor: String(userId), target: normalizedEmail, req });
    throw new BadRequestError("Invitation email could not be sent. Please try again later.");
  }

  await recordAudit({
    action: "INVITE_EMAIL_SENT",
    organization: String(orgId),
    actor: String(userId),
    target: normalizedEmail,
    meta: { to: normalizedEmail },
    req,
  });

  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email!,
    role: user.role,
    invitationId: newInvitation._id.toString(),
    expiresAt: newInvitation.expiresAt,
  };
}
