import { Organization } from "../../models/organization.js";
import { User } from "../../models/user.js";
import { Invitation } from "../../models/invitation.js";
import { recordAudit } from "../../services/auditService.js";
import { randomToken, hashToken } from "../../utils/crypto.js";
import { sendMail, buildInvitationEmail, buildInvitationUrl } from "../../services/mailService.js";
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from "../../utils/errors.js";
const INVITE_TOKEN_BYTES = 32;
const INVITE_EXPIRY_MS = 48 * 60 * 60 * 1000;
export async function createInvitation(orgId, invitedBy, data, req) {
    const org = await Organization.findById(orgId);
    if (!org)
        throw new NotFoundError("Organization not found");
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
    }
    catch (err) {
        const isRetryable = err instanceof BadRequestError ||
            err instanceof ForbiddenError ||
            err instanceof ConflictError;
        if (!isRetryable) {
            if (user)
                await User.deleteOne({ _id: user._id });
            if (invitation)
                await Invitation.deleteOne({ _id: invitation._id });
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
        expiresAt: invitation.expiresAt,
    };
}
export async function acceptInvitation(rawToken, req) {
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
    const updated = await Invitation.findOneAndUpdate({ _id: invitation._id, status: "pending" }, { $set: { status: "accepted", acceptedAt: new Date() } }, { new: true });
    if (!updated) {
        await recordAudit({ action: "INVITE_ACCEPT_REPLAY", organization: String(invitation.organization), target: invitation.user.toString(), req });
        throw new BadRequestError("Invitation token is invalid or expired.");
    }
    return {
        user,
        invitation: updated,
    };
}
/** Re-send the setup email for a pending staff invitation. */
export async function resendInvitation(orgId, userId, email, req) {
    const org = await Organization.findById(orgId);
    if (!org)
        throw new NotFoundError("Organization not found.");
    // Cross-organization / role / active-account guards. The "pending invite"
    // state is the source of truth: if no pending invitation exists for this
    // user, we refuse to resend (no "unknown email" probing).
    const user = await User.findOne({ organization: orgId, email: email.toLowerCase() });
    if (!user || user.role !== "STAFF" || user.isActive) {
        throw new NotFoundError("No pending invitation found for this staff member.");
    }
    const rawToken = randomToken(INVITE_TOKEN_BYTES);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + INVITE_EXPIRY_MS);
    const newInvitation = await Invitation.create({
        user: user._id,
        email,
        organization: orgId,
        invitedBy: userId,
        tokenHash,
        status: "pending",
        expiresAt,
    });
    const invitationUrl = buildInvitationUrl(rawToken);
    const emailPayload = buildInvitationEmail(user.name, invitationUrl, expiresAt);
    const sent = await sendMail({
        to: email,
        subject: emailPayload.subject,
        text: emailPayload.text,
        html: emailPayload.html,
    });
    if (!sent) {
        await Invitation.deleteOne({ _id: newInvitation._id });
        await recordAudit({ action: "INVITE_EMAIL_FAILED", organization: String(orgId), actor: String(userId), target: email, req });
        throw new BadRequestError("Invitation email could not be sent. Please try again later.");
    }
    // recordAudit returns void; tolerating the result directly.
    await recordAudit({
        action: "INVITE_EMAIL_SENT",
        organization: String(orgId),
        actor: String(userId),
        target: email,
        meta: { to: email },
        req,
    });
    return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        invitationId: newInvitation._id.toString(),
        expiresAt: newInvitation.expiresAt,
    };
}
//# sourceMappingURL=invitationService.js.map