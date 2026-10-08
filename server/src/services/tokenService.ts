import argon2 from "argon2";
import { RefreshToken } from "../models/refreshToken.js";
import { randomToken, hashToken } from "../utils/crypto.js";
import { UnauthorizedError } from "../utils/errors.js";

/** Argon2id hashing for passwords. */
export async function hashPassword(plain: string): Promise<string> {
  return argon2.hash(plain, { type: argon2.argon2id });
}

export async function verifyPassword(hash: string, plain: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/**
 * Issue a rotating refresh token. The raw token is returned to the client once;
 * only its sha256 hash is persisted. Rotation invalidates the previous token.
 */
export async function issueRefreshToken(userId: string, ttlDays: number): Promise<string> {
  const raw = randomToken();
  const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
  await RefreshToken.create({ user: userId, tokenHash: hashToken(raw), expiresAt });
  return raw;
}

/** Validate + rotate a refresh token. Returns the associated userId. */
export async function rotateRefreshToken(rawToken: string): Promise<string> {
  const tokenHash = hashToken(rawToken);
  const existing = await RefreshToken.findOne({ tokenHash });
  if (!existing || existing.revokedAt || existing.expiresAt < new Date()) {
    throw new UnauthorizedError("Invalid refresh token", "REFRESH_INVALID");
  }
  // Revoke the used token (rotation).
  existing.revokedAt = new Date();
  await existing.save();
  return existing.user.toString();
}

/** Revoke a specific refresh token (logout). */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  await RefreshToken.updateOne(
    { tokenHash: hashToken(rawToken) },
    { revokedAt: new Date() },
  );
}

/** Revoke all refresh tokens for a user (password change, 2FA reset, deactivation). */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await RefreshToken.updateMany(
    { user: userId, revokedAt: { $exists: false } },
    { revokedAt: new Date() },
  );
}
