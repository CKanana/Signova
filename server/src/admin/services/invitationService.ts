import { Organization } from "../../models/organization.js";
import { User } from "../../models/user.js";
import { Invitation } from "../../models/invitation.js";
import { SetupToken } from "../../models/setupToken.js";
import { recordAudit } from "../../services/auditService.js";
import { randomToken, hashToken } from "../../utils/crypto.js";
import { sendMail, buildInvitationEmail, buildSetupEmail } from "../../services/mailService.js";
import type { Types } from "mongoose";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
import { assertPasswordPolicy } from "../../utils/passwordPolicy.js";

const INVITE_TOKEN_BYTES = 32;
const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000;

export interface CreateInvitationInput {
  name: string;
  email: string;
}

export async function createInvitation(
  orgId: string | Types.ObjectId,
  invitedBy: string | Types.ObjectId,
  data: CreateInvitationInput,
  req: import("express").Request
) {
  const org = await Organization.findById(orgId);
  if (!org) throw new NotFoundError("Organization not found");

  const email = data.email.trim().toLowerCase();
  const name = data.name.trim();

  if (!email) {
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

  let user;
  let invitation;

  try {
    user = await User.create({
      organization: orgId,
      role: "STAFF",
      name,
      email,
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

    const baseUrl = String(process.env.APP_PUBLIC_BASE_URL ?? "").replace(/\/$/, "");
    const invitationUrl = `${baseUrl}/invite?token=${encodeURIComponent(rawToken)}`;
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

    const setupRaw = randomToken(32);
    const setupTokenHash = hashToken(setupRaw);
    const setupExpiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await SetupToken.create({
      user: user._id,
      tokenHash: setupTokenHash,
      scope: "password_setup",
      expiresAt: setupExpiresAt,
    });

    const setupBase = String(process.env.APP_PUBLIC_BASE_URL ?? baseUrl).replace(/\/$/, "");
    const setupUrl = `${setupBase}/staff-setup?token=${encodeURIComponent(setupRaw)}`;
    const setupEmail = buildSetupEmail(name, org.name, setupUrl, setupExpiresAt);
    const setupSent = await sendMail({
      to: email,
      subject: setupEmail.subject,
      text: setupEmail.text,
      html: setupEmail.html,
    });

    if (!setupSent) {
      await SetupToken.deleteOne({ tokenHash: setupTokenHash });
      await recordAudit({ action: "STAFF_SETUP_EMAIL_FAILED", organization: String(orgId), actor: String(invitedBy), target: user._id.toString(), req });
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

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    invitationId: invitation!._id,
    expiresAt: invitation!.expiresAt,
  };
}

export async function acceptInvitation(rawToken: string, req: import("express").Request) {
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

  const user = await User.findById(invitation.user);
  if (!user || !user.email || user.email.toLowerCase() !== invitation.email.toLowerCase()) {
    await recordAudit({ action: "INVITE_ACCEPT_BAD_USER", organization: String(invitation.organization), target: invitation.user.toString(), req });
    throw new BadRequestError("Invitation token is invalid or expired.");
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

  return {
    user,
    invitation: updated,
  };
}
