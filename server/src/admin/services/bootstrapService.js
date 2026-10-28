import { SetupToken } from "../../models/setupToken.js";
import { User } from "../../models/user.js";
import { Organization } from "../../models/organization.js";
import { hashPassword, issueRefreshToken, revokeAllRefreshTokens } from "../../services/tokenService.js";
import { generateTotpSecret, verifyTotp } from "../../utils/totp.js";
import { verifyChallengeToken, signChallengeToken, signAccessToken } from "../../utils/jwt.js";
import { decryptSecret, encryptSecret, hashToken } from "../../utils/crypto.js";
import { recordAudit } from "../../services/auditService.js";
import { BadRequestError, UnauthorizedError } from "../../utils/errors.js";
import { assertPasswordPolicy } from "../../utils/passwordPolicy.js";
// Single-use consume helper using compare-and-set semantics.
async function consumeSetupToken(tokenHash) {
    const token = await SetupToken.findOneAndUpdate({ tokenHash, usedAt: { $exists: false } }, { $set: { usedAt: new Date() } }, { new: true });
    return token;
}
export async function acceptBootstrap(input) {
    const tokenHash = hashToken(input.token);
    const token = await consumeSetupToken(tokenHash);
    if (!token) {
        await recordAudit({ action: "BOOTSTRAP_ACCEPT_UNKNOWN", target: "" });
        throw new BadRequestError("This setup link is invalid or has expired.");
    }
    if (token.expiresAt.getTime() <= Date.now()) {
        await recordAudit({ action: "BOOTSTRAP_ACCEPT_EXPIRED", target: token.user.toString() });
        throw new BadRequestError("This setup link has expired. Contact support.");
    }
    if (token.scope !== "bootstrap") {
        await recordAudit({ action: "BOOTSTRAP_ACCEPT_BAD_SCOPE", target: token.user.toString() });
        throw new BadRequestError("This setup link is invalid or has expired.");
    }
    const user = await User.findById(token.user).select("+passwordHash");
    if (!user || !user.email || user.role !== "ADMIN") {
        await recordAudit({ action: "BOOTSTRAP_ACCEPT_BAD_USER", target: token.user.toString() });
        throw new BadRequestError("This setup link is invalid or has expired.");
    }
    const org = await Organization.findById(user.organization);
    if (!org || org.bootstrapAdminEmail?.toLowerCase() !== user.email?.toLowerCase()) {
        await recordAudit({ action: "BOOTSTRAP_ACCEPT_NOT_AUTHORIZED", organization: String(user.organization), target: user._id.toString() });
        throw new BadRequestError("This setup link is invalid or has expired.");
    }
    const normalized = user.email.trim().toLowerCase();
    const collision = await User.findOne({ email: normalized }).select("+passwordHash");
    if (collision && collision._id.toString() !== user._id.toString()) {
        await recordAudit({ action: "BOOTSTRAP_ACCEPT_CONFLICT", organization: String(user.organization), target: user._id.toString() });
        throw new BadRequestError("This setup link is invalid or has expired.");
    }
    if (input.password.length < 10) {
        await recordAudit({ action: "BOOTSTRAP_ACCEPT_WEAK_PASSWORD", organization: String(user.organization), target: user._id.toString() });
        throw new BadRequestError("Password must be at least 10 characters.");
    }
    assertPasswordPolicy(input.password);
    const secret = generateTotpSecret();
    const challengeToken = signChallengeToken(user._id.toString(), "mfa_enroll");
    user.passwordHash = await hashPassword(input.password);
    user.totpSecret = encryptSecret(secret);
    user.twoFactorEnabled = false;
    user.twoFactorConfirmedAt = undefined;
    user.totpLastUsedStep = undefined;
    user.isActive = false;
    user.failedLoginCount = 0;
    user.lockedUntil = undefined;
    await user.save();
    await recordAudit({ action: "BOOTSTRAP_ACCEPTED", organization: String(user.organization), actor: user._id, target: user._id.toString() });
    return {
        status: "mfa_enroll_required",
        challengeToken,
        user: { id: user._id.toString(), name: user.name, email: user.email },
    };
}
export async function activateBootstrap(input) {
    const payload = verifyChallengeToken(input.challengeToken);
    if (payload.scope !== "mfa_enroll") {
        throw new BadRequestError("Challenge token is not for enrollment");
    }
    const user = await User.findById(payload.sub).select("+totpSecret +totpLastUsedStep");
    if (!user || !user.totpSecret || user.role !== "ADMIN") {
        throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
    }
    const check = verifyTotp(decryptSecret(user.totpSecret), input.code, user.totpLastUsedStep);
    if (!check.valid) {
        await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization });
        throw new UnauthorizedError(check.reason === "ALREADY_USED" ? "This code was already used. Wait for the next one." : "Invalid authentication code", "OTP_INVALID");
    }
    const claimed = await User.updateOne({ _id: user._id, $or: [{ totpLastUsedStep: { $exists: false } }, { totpLastUsedStep: { $lt: check.absoluteStep } }] }, { $set: { totpLastUsedStep: check.absoluteStep } });
    if (claimed.modifiedCount !== 1) {
        await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization, meta: { reason: "replay" } });
        throw new UnauthorizedError("This code was already used. Wait for the next one.", "OTP_INVALID");
    }
    user.twoFactorEnabled = true;
    user.twoFactorConfirmedAt = new Date();
    user.isActive = true;
    await user.save();
    await revokeAllRefreshTokens(user._id.toString());
    await recordAudit({ action: "BOOTSTRAP_ACTIVATED", organization: String(user.organization), actor: user._id, target: user._id.toString() });
    return {
        status: "active",
        accessToken: signAccessToken({ sub: user._id.toString(), orgId: user.organization.toString(), role: user.role }),
        refreshToken: await issueRefreshToken(user._id.toString(), 7),
        user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, twoFactorEnabled: true, isActive: true },
    };
}
//# sourceMappingURL=bootstrapService.js.map