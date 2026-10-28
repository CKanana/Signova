import argon2 from "argon2";
import { RefreshToken } from "../models/refreshToken.js";
import { randomToken, hashToken } from "../utils/crypto.js";
import { UnauthorizedError } from "../utils/errors.js";
/** Argon2id hashing for passwords. */
export async function hashPassword(plain) {
    return argon2.hash(plain, { type: argon2.argon2id });
}
export async function verifyPassword(hash, plain) {
    try {
        return await argon2.verify(hash, plain);
    }
    catch {
        return false;
    }
}
/**
 * Issue a rotating refresh token. The raw token is returned to the client once;
 * only its sha256 hash is persisted. Rotation invalidates the previous token.
 */
export async function issueRefreshToken(userId, ttlDays) {
    const raw = randomToken();
    const expiresAt = new Date(Date.now() + ttlDays * 24 * 60 * 60 * 1000);
    await RefreshToken.create({ user: userId, tokenHash: hashToken(raw), expiresAt });
    return raw;
}
/** Validate + rotate a refresh token atomically. Returns the associated userId. */
export async function rotateRefreshToken(rawToken) {
    const { recordAudit } = await import("./auditService.js");
    const tokenHash = hashToken(rawToken);
    const now = new Date();
    // Atomic claim: only succeeds when the token is unused and unexpired.
    const claimed = await RefreshToken.findOneAndUpdate({ tokenHash, revokedAt: { $exists: false }, expiresAt: { $gt: now } }, { $set: { revokedAt: now } }, { new: true });
    if (claimed) {
        return claimed.user.toString();
    }
    // Not claimed: check if this token was previously revoked (Reuse Detection).
    const existing = await RefreshToken.findOne({ tokenHash });
    if (existing && existing.revokedAt) {
        // A revoked refresh token was presented — this indicates a replay or token-theft breach.
        // Invalidate the entire active session family for this user immediately.
        await revokeAllRefreshTokens(existing.user.toString());
        await recordAudit({
            action: "REFRESH_TOKEN_REUSE",
            actor: existing.user,
            target: existing.user.toString(),
            meta: { tokenHash: tokenHash.slice(0, 16) },
        });
        throw new UnauthorizedError("Compromised session token detected. All sessions have been revoked.", "REFRESH_TOKEN_REUSED");
    }
    throw new UnauthorizedError("Invalid refresh token", "REFRESH_INVALID");
}
/** Revoke a specific refresh token (logout). */
export async function revokeRefreshToken(rawToken) {
    await RefreshToken.updateOne({ tokenHash: hashToken(rawToken) }, { revokedAt: new Date() });
}
/** Revoke all refresh tokens for a user (password change, 2FA reset, deactivation). */
export async function revokeAllRefreshTokens(userId) {
    await RefreshToken.updateMany({ user: userId, revokedAt: { $exists: false } }, { revokedAt: new Date() });
}
//# sourceMappingURL=tokenService.js.map