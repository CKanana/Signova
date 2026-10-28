import type { Request } from "express";
import type { Types } from "mongoose";
export interface AuthResult {
    status: "2fa_required" | "mfa_enroll_required" | "authenticated" | "pending_approval" | "setup_required";
    challengeToken?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: PublicUser;
    message?: string;
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
/** Step 1 — password login. Returns the next required step. */
export declare function login(email: string, password: string, req: Request): Promise<AuthResult>;
/** Step 2a — verify a TOTP code during a normal 2FA login. */
export declare function verifyTwoFactor(challengeToken: string, code: string, req: Request): Promise<AuthResult>;
/** Step 2b — start 2FA enrollment. Returns secret + QR for the authenticator app. */
export declare function startTwoFactorEnrollment(challengeToken: string): Promise<{
    secret: string;
    otpauthUrl: string;
    qrDataUrl: string;
}>;
/** Step 2c — confirm enrollment with a valid code, then activate 2FA. */
export declare function activateTwoFactorEnrollment(challengeToken: string, code: string, req: Request): Promise<AuthResult>;
/** Logout — revoke the presented refresh token. */
export declare function logout(refreshToken: string, req: Request): Promise<void>;
/** Exchange a valid refresh token for a new access token (rotation). */
export declare function refresh(rawRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
}>;
/** Load a public user profile by id (for /auth/me). */
export declare function getPublicUser(userId: string | Types.ObjectId): Promise<PublicUser>;
/** Admin-triggered 2FA reset: clears 2FA and revokes all sessions. */
export declare function resetTwoFactor(userId: string, actorId: string, req: Request): Promise<void>;
/** Change own password (requires current password). */
export declare function changePassword(userId: string, currentPassword: string, newPassword: string, req: Request): Promise<void>;
/**
 * Self-registration for hearing staff (public endpoint).
 *
 * Policy (current, approved):
 *  - Only gmail.com addresses may self-register. The domain is compared
 *    after full normalization (trim + lowercase) against an exact match —
 *    subdomains (mail.gmail.com), suffixes (notgmail.com) and lookalikes
 *    (gmail.com.evil.net) are all rejected. `signova.test` and seeded
 *    accounts keep working because the policy applies to PUBLIC
 *    REGISTRATION only — seeded accounts are created by the seed script,
 *    never through this path.
 *  - The organization must exist and be active. Registration into another
 *    organization's account is impossible: org membership comes from this
 *    server-side lookup, not from anything the client claims.
 *  - Role is hardcoded STAFF. The request body has no role field and the
 *    model enum is the only other source — public registration can never
 *    create an ADMIN.
 *  - A duplicate email in the same organization is rejected (409). The
 *    race is guarded server-side by the partial unique index on
 *    {organization, email}, so two simultaneous requests cannot both win.
 *
 * The account is created with 2FA DISABLED, which is intentional: the
 * standard login flow then returns `mfa_enroll_required`, and the client
 * walks the user through QR enrollment before any token is issued. No
 * session exists until 2FA is confirmed — registration can never bypass
 * authentication.
 */
export declare function registerStaff(input: {
    name: string;
    organizationId: string;
    email: string;
    password: string;
}, req: Request): Promise<AuthResult>;
/** Normalize an email for storage and lookup: trimmed + lowercased. */
export declare function normalizeEmail(email: string): string;
export declare function isGmailAddress(email: string): boolean;
/**
 * Request a password reset for a staff account.
 *
 * Security properties:
 *  - The response is ALWAYS the same generic message, whether or not the
 *    email exists, is a staff account, or is eligible. No enumeration.
 *  - Role is never taken from the request; only STAFF accounts are eligible.
 *  - Only the sha256 hash of a cryptographically-random token is stored.
 *  - A new request supersedes (deletes) any outstanding token for the user,
 *    so at most one active reset token exists per account.
 *  - If email delivery fails, the freshly-created token is removed so no
 *    undeliverable token is left usable, and a safe generic response is
 *    still returned.
 *  - The reset link is built ONLY from the trusted PASSWORD_RESET_BASE_URL
 *    (never the request Host header) and contains no PII.
 *
 * Email ambiguity: email uniqueness is per-organization, so the same address
 * may exist in several orgs. Recovery targets the first matching STAFF
 * account (by createdAt). The issued token is bound to that specific user id,
 * so it cannot be redeemed for any other account or organization.
 */
export declare function requestPasswordReset(email: string, req: Request): Promise<void>;
/**
 * Redeem a reset token and set a new password.
 *
 *  - Validates the token hash, expiration, and unused status, bound to a
 *    specific user (resolved from the record — never from the request).
 *  - Consumes the token exactly once via an atomic findOneAndUpdate, so
 *    concurrent redemption of the same token cannot both succeed.
 *  - Hashes the new password with the existing Argon2id utility.
 *  - Revokes ALL existing refresh tokens for the user (logs them out).
 *  - Does NOT issue any session — the user must sign in again and complete
 *    TOTP. Does NOT touch the TOTP secret or enabled status.
 */
export declare function resetPassword(token: string, newPassword: string, req: Request): Promise<void>;
