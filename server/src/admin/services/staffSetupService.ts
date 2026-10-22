import mongoose from "mongoose";
import { SetupToken } from "../../models/setupToken.js";
import { User } from "../../models/user.js";
import { hashPassword } from "../../services/tokenService.js";
import { generateTotpSecret, verifyTotp } from "../../utils/totp.js";
import { decryptSecret, encryptSecret, hashToken } from "../../utils/crypto.js";
import { verifyChallengeToken, signChallengeToken, signAccessToken } from "../../utils/jwt.js";
import { recordAudit } from "../../services/auditService.js";
import { BadRequestError, UnauthorizedError } from "../../utils/errors.js";
import { BOOTSTRAP_SETUP_TOKEN_TTL_MS } from "../../config/env.js";
import { assertPasswordPolicy } from "../../utils/passwordPolicy.js";
import { issueRefreshToken, revokeAllRefreshTokens } from "../../services/tokenService.js";

export interface AcceptStaffSetupInput {
  token: string;
  password: string;
}

export interface AcceptStaffSetupResult {
  status: "mfa_enroll_required";
  challengeToken: string;
  user: { id: string; name: string; email?: string };
}

async function consumeSetupToken(tokenHash: string) {
  const token = await SetupToken.findOneAndUpdate(
    { tokenHash, usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
    { new: true },
  );
  return token;
}

export async function acceptStaffSetup(input: AcceptStaffSetupInput): Promise<AcceptStaffSetupResult> {
  const tokenHash = hashToken(input.token);

  const token = await consumeSetupToken(tokenHash);
  if (!token) {
    await recordAudit({ action: "STAFF_SETUP_UNKNOWN_TOKEN", target: "" });
    throw new BadRequestError("This setup link is invalid or has expired.");
  }

  if (token.expiresAt.getTime() <= Date.now()) {
    await recordAudit({ action: "STAFF_SETUP_EXPIRED", target: token.user.toString() });
    throw new BadRequestError("This setup link has expired. Contact support.");
  }

  if (token.scope !== "password_setup") {
    await recordAudit({ action: "STAFF_SETUP_BAD_SCOPE", target: token.user.toString() });
    throw new BadRequestError("This setup link is invalid or has expired.");
  }

  const user = await User.findById(token.user).select("+passwordHash");
  if (!user || !user.email || user.role !== "STAFF") {
    await recordAudit({ action: "STAFF_SETUP_BAD_USER", target: token.user.toString() });
    throw new BadRequestError("This setup link is invalid or has expired.");
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

  await recordAudit({ action: "STAFF_SETUP_PASSWORD_SET", organization: String(user.organization), actor: user._id, target: user._id.toString() });

  return {
    status: "mfa_enroll_required",
    challengeToken,
    user: { id: user._id.toString(), name: user.name, email: user.email },
  };
}

export async function activateStaffSetup(challengeToken: string, code: string) {
  const payload = verifyChallengeToken(challengeToken);
  if (payload.scope !== "mfa_enroll") {
    throw new BadRequestError("Challenge token is not for enrollment");
  }

  const user = await User.findById(payload.sub).select("+totpSecret +totpLastUsedStep");
  if (!user || !user.totpSecret || user.role !== "STAFF") {
    throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
  }

  const check = verifyTotp(decryptSecret(user.totpSecret), code, user.totpLastUsedStep);
  if (!check.valid) {
    await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization });
    throw new UnauthorizedError(
      check.reason === "ALREADY_USED" ? "This code was already used. Wait for the next one." : "Invalid authentication code",
      "OTP_INVALID",
    );
  }

  const claimed = await User.updateOne(
    { _id: user._id, $or: [{ totpLastUsedStep: { $exists: false } }, { totpLastUsedStep: { $lt: check.absoluteStep } }] },
    { $set: { totpLastUsedStep: check.absoluteStep } },
  );
  if (claimed.modifiedCount !== 1) {
    await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization, meta: { reason: "replay" } });
    throw new UnauthorizedError("This code was already used. Wait for the next one.", "OTP_INVALID");
  }

  user.twoFactorEnabled = true;
  user.twoFactorConfirmedAt = new Date();
  user.isActive = true;
  await user.save();

  await revokeAllRefreshTokens(user._id.toString());

  await recordAudit({ action: "STAFF_SETUP_ACTIVATED", organization: String(user.organization), actor: user._id, target: user._id.toString() });

  return {
    status: "authenticated",
    accessToken: signAccessToken({ sub: user._id.toString(), orgId: user.organization.toString(), role: user.role }),
    refreshToken: await issueRefreshToken(user._id.toString(), 7),
    user: { id: user._id.toString(), name: user.name, email: user.email, role: user.role, twoFactorEnabled: true, isActive: true },
  };
}
