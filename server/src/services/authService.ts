import qrcode from "qrcode";
import { User } from "../models/user.js";
import { encryptSecret, decryptSecret } from "../utils/crypto.js";
import { generateTotpSecret, buildOtpAuthUrl, verifyTotp } from "../utils/totp.js";
import { verifyChallengeToken, signChallengeToken, signAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword, issueRefreshToken, revokeRefreshToken, revokeAllRefreshTokens } from "./tokenService.js";
import { recordAudit } from "./auditService.js";
import { UnauthorizedError, BadRequestError, ConflictError, NotFoundError } from "../utils/errors.js";
import type { Request } from "express";
import type { Types } from "mongoose";

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const REFRESH_TTL_DAYS = 7;

export interface AuthResult {
  status: "2fa_required" | "mfa_enroll_required" | "authenticated";
  challengeToken?: string;
  accessToken?: string;
  refreshToken?: string;
  user?: PublicUser;
}

export interface PublicUser {
  id: string;
  organization: string;
  role: "ADMIN" | "STAFF" | "DEAF_USER";
  name: string;
  email?: string;
  avatar?: string;
  twoFactorEnabled: boolean;
  isActive: boolean;
}

function toPublicUser(u: any): PublicUser {
  return {
    id: u._id.toString(),
    organization: u.organization.toString(),
    role: u.role,
    name: u.name,
    email: u.email,
    avatar: u.avatar,
    twoFactorEnabled: u.twoFactorEnabled,
    isActive: u.isActive,
  };
}

/** Step 1 — password login. Returns the next required step. */
export async function login(email: string, password: string, req: Request): Promise<AuthResult> {
  const user = await User.findOne({ email: email.toLowerCase() }).select(
    "+passwordHash +failedLoginCount +lockedUntil",
  );

  // Uniform error to avoid leaking whether the account exists.
  const invalid = () => new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");

  if (!user || !user.passwordHash) {
    await recordAudit({ action: "LOGIN_FAILED", target: email, req });
    throw invalid();
  }

  if (user.lockedUntil && user.lockedUntil > new Date()) {
    await recordAudit({ action: "LOGIN_FAILED", target: email, meta: { reason: "locked" }, req });
    throw new UnauthorizedError("Account temporarily locked. Try again later.", "ACCOUNT_LOCKED");
  }

  const ok = await verifyPassword(user.passwordHash, password);
  if (!ok) {
    user.failedLoginCount += 1;
    if (user.failedLoginCount >= MAX_FAILED_LOGINS) {
      user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
      user.failedLoginCount = 0;
    }
    await user.save();
    await recordAudit({ action: "LOGIN_FAILED", target: email, req });
    throw invalid();
  }

  if (!user.isActive) {
    throw new UnauthorizedError("Account is deactivated", "ACCOUNT_INACTIVE");
  }

  // Reset failed-login counter on success.
  user.failedLoginCount = 0;
  user.lockedUntil = undefined;
  await user.save();

  if (user.twoFactorEnabled) {
    const challengeToken = signChallengeToken(user._id.toString(), "2fa");
    await recordAudit({ action: "LOGIN", actor: user._id, organization: user.organization, req });
    return { status: "2fa_required", challengeToken };
  }

  // 2FA not set up yet → must enroll before receiving a full token.
  const challengeToken = signChallengeToken(user._id.toString(), "mfa_enroll");
  await recordAudit({ action: "LOGIN", actor: user._id, organization: user.organization, req });
  return { status: "mfa_enroll_required", challengeToken };
}

/** Step 2a — verify a TOTP code during a normal 2FA login. */
export async function verifyTwoFactor(challengeToken: string, code: string, req: Request): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyChallengeToken(challengeToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired challenge", "CHALLENGE_INVALID");
  }
  if (payload.scope !== "2fa") {
    throw new BadRequestError("Challenge token is not for 2FA verification");
  }

  const user = await User.findById(payload.sub).select("+totpSecret");
  if (!user || !user.totpSecret) {
    throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
  }

  const secret = decryptSecret(user.totpSecret);
  const valid = verifyTotp(secret, code);
  if (!valid) {
    await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization, req });
    throw new UnauthorizedError("Invalid authentication code", "OTP_INVALID");
  }

  await recordAudit({ action: "OTP_VERIFY", actor: user._id, organization: user.organization, req });
  return issueFullSession(user);
}

/** Step 2b — start 2FA enrollment. Returns secret + QR for the authenticator app. */
export async function startTwoFactorEnrollment(challengeToken: string): Promise<{
  secret: string;
  otpauthUrl: string;
  qrDataUrl: string;
}> {
  let payload;
  try {
    payload = verifyChallengeToken(challengeToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired challenge", "CHALLENGE_INVALID");
  }
  if (payload.scope !== "mfa_enroll") {
    throw new BadRequestError("Challenge token is not for enrollment");
  }

  const user = await User.findById(payload.sub).select("+totpSecret");
  if (!user) throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
  if (user.twoFactorEnabled) throw new ConflictError("2FA already enabled");

  const secret = generateTotpSecret();
  user.totpSecret = encryptSecret(secret); // stored, not yet active
  await user.save();

  const otpauthUrl = buildOtpAuthUrl(secret, user.email ?? user.name);
  const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

  await recordAudit({ action: "2FA_ENROLL_START", actor: user._id, organization: user.organization });
  return { secret, otpauthUrl, qrDataUrl };
}

/** Step 2c — confirm enrollment with a valid code, then activate 2FA. */
export async function activateTwoFactorEnrollment(
  challengeToken: string,
  code: string,
  req: Request,
): Promise<AuthResult> {
  let payload;
  try {
    payload = verifyChallengeToken(challengeToken);
  } catch {
    throw new UnauthorizedError("Invalid or expired challenge", "CHALLENGE_INVALID");
  }
  if (payload.scope !== "mfa_enroll") {
    throw new BadRequestError("Challenge token is not for enrollment");
  }

  const user = await User.findById(payload.sub).select("+totpSecret");
  if (!user || !user.totpSecret) {
    throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
  }

  const secret = decryptSecret(user.totpSecret);
  const valid = verifyTotp(secret, code);
  if (!valid) {
    await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization, req });
    throw new UnauthorizedError("Invalid authentication code", "OTP_INVALID");
  }

  user.twoFactorEnabled = true;
  user.twoFactorConfirmedAt = new Date();
  await user.save();

  await recordAudit({ action: "2FA_ENROLL_ACTIVATE", actor: user._id, organization: user.organization, req });
  return issueFullSession(user);
}

async function issueFullSession(user: any): Promise<AuthResult> {
  const accessToken = signAccessToken({
    sub: user._id.toString(),
    orgId: user.organization.toString(),
    role: user.role,
  });
  const refreshToken = await issueRefreshToken(user._id.toString(), REFRESH_TTL_DAYS);
  return { status: "authenticated", accessToken, refreshToken, user: toPublicUser(user) };
}

/** Logout — revoke the presented refresh token. */
export async function logout(refreshToken: string, req: Request): Promise<void> {
  await revokeRefreshToken(refreshToken);
  await recordAudit({ action: "LOGOUT", req });
}

/** Exchange a valid refresh token for a new access token (rotation). */
export async function refresh(rawRefreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
  const userId = await rotateRefreshTokenSafe(rawRefreshToken);
  const user = await User.findById(userId);
  if (!user || !user.isActive) throw new UnauthorizedError("Account unavailable");

  const accessToken = signAccessToken({
    sub: user._id.toString(),
    orgId: user.organization.toString(),
    role: user.role,
  });
  const refreshToken = await issueRefreshToken(user._id.toString(), REFRESH_TTL_DAYS);
  return { accessToken, refreshToken };
}

// Small wrapper so rotateRefreshToken errors map to a clean 401.
async function rotateRefreshTokenSafe(token: string): Promise<string> {
  const { rotateRefreshToken } = await import("./tokenService.js");
  return rotateRefreshToken(token);
}

/** Load a public user profile by id (for /auth/me). */
export async function getPublicUser(userId: string | Types.ObjectId): Promise<PublicUser> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");
  return toPublicUser(user);
}

/** Admin-triggered 2FA reset: clears 2FA and revokes all sessions. */
export async function resetTwoFactor(userId: string, actorId: string, req: Request): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError("User not found");
  user.twoFactorEnabled = false;
  user.totpSecret = undefined;
  user.twoFactorConfirmedAt = undefined;
  await user.save();
  await revokeAllRefreshTokens(userId);
  await recordAudit({ action: "2FA_RESET", actor: actorId, organization: user.organization, target: userId, req });
}

/** Change own password (requires current password). */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
  req: Request,
): Promise<void> {
  const user = await User.findById(userId).select("+passwordHash");
  if (!user || !user.passwordHash) throw new NotFoundError("User not found");
  const ok = await verifyPassword(user.passwordHash, currentPassword);
  if (!ok) throw new UnauthorizedError("Current password is incorrect");
  user.passwordHash = await hashPassword(newPassword);
  await user.save();
  await revokeAllRefreshTokens(userId);
  await recordAudit({ action: "PASSWORD_CHANGE", actor: userId, organization: user.organization, req });
}
