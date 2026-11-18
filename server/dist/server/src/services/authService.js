import qrcode from "qrcode";
import { User } from "../models/user.js";
import { Organization } from "../models/organization.js";
import { PasswordResetToken } from "../models/passwordResetToken.js";
import { encryptSecret, decryptSecret, randomToken, hashToken } from "../utils/crypto.js";
import { generateTotpSecret, buildOtpAuthUrl, verifyTotp } from "../utils/totp.js";
import { verifyChallengeToken, signChallengeToken, signAccessToken } from "../utils/jwt.js";
import { hashPassword, verifyPassword, issueRefreshToken, revokeRefreshToken, revokeAllRefreshTokens } from "./tokenService.js";
import { sendMail, buildResetEmail, buildWelcomeEmail } from "./mailService.js";
import { recordAudit } from "./auditService.js";
import { UnauthorizedError, BadRequestError, ConflictError, NotFoundError } from "../utils/errors.js";
import { config } from "../config/env.js";
import { assertPasswordPolicy } from "../utils/passwordPolicy.js";
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const REFRESH_TTL_DAYS = 7;
function toPublicUser(u) {
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
export async function login(email, password, req) {
    const user = await User.findOne({ email: normalizeEmail(email) }).select("+passwordHash +failedLoginCount +lockedUntil +totpSecret");
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
        if (!user.passwordHash) {
            throw new UnauthorizedError("Account setup is incomplete. Use the setup link from your email.", "ACCOUNT_SETUP_INCOMPLETE");
        }
        if (!user.twoFactorEnabled) {
            const isBootstrapAdmin = user.role === "ADMIN" &&
                user.email !== undefined &&
                user.email.trim().toLowerCase() === "crystal.kanana@strathmore.edu";
            if (isBootstrapAdmin) {
                if (user.totpSecret) {
                    const challengeToken = signChallengeToken(user._id.toString(), "2fa");
                    await recordAudit({ action: "LOGIN", actor: user._id, organization: user.organization, req });
                    return { status: "2fa_required", challengeToken };
                }
                const challengeToken = signChallengeToken(user._id.toString(), "mfa_enroll");
                await recordAudit({ action: "LOGIN", actor: user._id, organization: user.organization, req });
                return { status: "mfa_enroll_required", challengeToken };
            }
            throw new UnauthorizedError("Your account is pending administrator approval. Please wait for an administrator to approve your account before signing in.", "ACCOUNT_PENDING_APPROVAL");
        }
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
    // Has a stored TOTP secret but hasn't confirmed 2FA yet: verify the code,
    // don't force a fresh enrollment.
    if (user.totpSecret) {
        const challengeToken = signChallengeToken(user._id.toString(), "2fa");
        await recordAudit({ action: "LOGIN", actor: user._id, organization: user.organization, req });
        return { status: "2fa_required", challengeToken };
    }
    // 2FA not set up yet → must enroll before receiving a full token.
    const challengeToken = signChallengeToken(user._id.toString(), "mfa_enroll");
    await recordAudit({ action: "LOGIN", actor: user._id, organization: user.organization, req });
    return { status: "mfa_enroll_required", challengeToken };
}
/** Step 1b — Google sign-in. Verifies the ID token, matches the account, and returns the next step. */
export async function loginWithGoogle(googleIdToken, req) {
    // Internal request id for tracing cross-service flows.
    const requestId = randomToken(16);
    // 1. Verify the Google ID token using Google's official verification
    //    (signature, issuer, audience, expiry, email_verified).
    const googleAuth = await import("../services/googleAuth.js");
    const verified = await googleAuth.verifyGoogleIdToken(googleIdToken);
    // 2a. Match the verified Google `sub` to an existing provisioned Signova account.
    let user = await User.findOne({ googleSub: verified.userId })
        .select("+googleSub +passwordHash +failedLoginCount +lockedUntil +twoFactorEnabled +isActive");
    // 2b. If no `googleSub` match, attempt email-based auto-linking on first
    //     Google login. We only link when:
    //       - Google has verified the email address (email_verified = true)
    //       - A matching active Signova account exists with that email
    //       - The account does not already have a different googleSub
    //     On success we write the googleSub so future logins skip this step.
    if (!user && verified.emailVerified && verified.email) {
        const emailMatch = await User.findOne({
            email: verified.email.toLowerCase(),
            role: { $in: ["STAFF", "ADMIN"] },
        }).select("+googleSub +passwordHash +failedLoginCount +lockedUntil +twoFactorEnabled +isActive");
        if (emailMatch && !emailMatch.googleSub) {
            // Link this Google account to the existing user. Atomic update so
            // two concurrent first-time Google logins cannot both succeed.
            const linked = await User.findOneAndUpdate({ _id: emailMatch._id, googleSub: { $exists: false } }, { $set: { googleSub: verified.userId } }, { new: true }).select("+googleSub +passwordHash +failedLoginCount +lockedUntil +twoFactorEnabled +isActive");
            if (linked) {
                user = linked;
                await recordAudit({
                    action: "GOOGLE_ACCOUNT_LINKED",
                    actor: linked._id,
                    organization: linked.organization,
                    meta: { email: verified.email, googleSub: verified.userId },
                    req,
                });
            }
        }
    }
    if (!user) {
        await recordAudit({
            action: "LOGIN_FAILED",
            target: verified.userId,
            meta: { email: verified.email, emailVerified: verified.emailVerified, reason: "no_matching_account" },
            req,
        });
        return {
            status: "google_account_not_found",
            message: "No Signova account found for this Google address. Sign in with your email and password first, then Google Sign-In will link automatically next time.",
            requestId,
            _internal: { requestId },
        };
    }
    // 3. Re-validate account state.
    if (!user.isActive) {
        await recordAudit({ action: "LOGIN_FAILED", target: user._id.toString(), req, meta: { email: verified.email, reason: "inactive" } });
        return {
            status: "google_unverified",
            message: "This Signova account is inactive. Contact your administrator.",
            requestId,
            _internal: { requestId },
        };
    }
    // 4. Issue a TOTP challenge. New accounts (no 2FA) go through enrollment;
    //    existing users receive the TOTP challenge step.
    if (!user.twoFactorEnabled) {
        const challengeToken = signChallengeToken(user._id.toString(), "mfa_enroll");
        await recordAudit({ action: "GOOGLE_LOGIN", actor: user._id, organization: user.organization, req });
        return {
            status: "mfa_enroll_required",
            challengeToken,
            user: toPublicUser(user),
            requestId,
            _internal: { requestId },
        };
    }
    const challengeToken = signChallengeToken(user._id.toString(), "2fa");
    await recordAudit({ action: "GOOGLE_LOGIN", actor: user._id, organization: user.organization, req });
    return {
        status: "google_verified",
        challengeToken,
        user: toPublicUser(user),
        requestId,
        _internal: { requestId },
    };
}
/** Step 2a — verify a TOTP code during a normal 2FA login. */
export async function verifyTwoFactor(challengeToken, code, req) {
    let payload;
    try {
        payload = verifyChallengeToken(challengeToken);
    }
    catch {
        throw new UnauthorizedError("Invalid or expired challenge", "CHALLENGE_INVALID");
    }
    if (payload.scope !== "2fa") {
        throw new BadRequestError("Challenge token is not for 2FA verification");
    }
    const user = await User.findById(payload.sub).select("+totpSecret +totpLastUsedStep");
    if (!user || !user.totpSecret) {
        throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
    }
    const check = verifyTotp(decryptSecret(user.totpSecret), code, user.totpLastUsedStep);
    if (!check.valid) {
        await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization, req });
        throw new UnauthorizedError(check.reason === "ALREADY_USED" ? "This code was already used. Wait for the next one." : "Invalid authentication code", "OTP_INVALID");
    }
    // Claim the step atomically — a concurrent replay loses this race.
    if (!(await claimTotpStep(user._id.toString(), check.absoluteStep))) {
        throw new UnauthorizedError("This code was already used. Wait for the next one.", "OTP_INVALID");
    }
    const isBootstrapAdmin = user.role === "ADMIN" &&
        user.email !== undefined &&
        user.email.trim().toLowerCase() === "crystal.kanana@strathmore.edu";
    if (isBootstrapAdmin && !user.isActive && !user.twoFactorEnabled) {
        user.twoFactorEnabled = true;
        user.twoFactorConfirmedAt = new Date();
        user.isActive = true;
        await user.save();
        await recordAudit({ action: "BOOTSTRAP_ACTIVATED", actor: user._id, organization: user.organization, req });
    }
    await recordAudit({ action: "OTP_VERIFY", actor: user._id, organization: user.organization, req });
    return issueFullSession(user);
}
/** Step 2b — start 2FA enrollment. Returns secret + QR for the authenticator app. */
export async function startTwoFactorEnrollment(challengeToken) {
    let payload;
    try {
        payload = verifyChallengeToken(challengeToken);
    }
    catch {
        throw new UnauthorizedError("Invalid or expired challenge", "CHALLENGE_INVALID");
    }
    if (payload.scope !== "mfa_enroll") {
        throw new BadRequestError("Challenge token is not for enrollment");
    }
    const user = await User.findById(payload.sub).select("+totpSecret");
    if (!user)
        throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
    if (user.twoFactorEnabled)
        throw new ConflictError("2FA already enabled");
    const secret = generateTotpSecret();
    user.totpSecret = encryptSecret(secret); // stored, not yet active
    user.totpLastUsedStep = undefined;
    await user.save();
    const otpauthUrl = buildOtpAuthUrl(secret, user.email ?? user.name);
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
    await recordAudit({ action: "2FA_ENROLL_START", actor: user._id, organization: user.organization });
    return { secret, otpauthUrl, qrDataUrl };
}
/** Step 2b-ctrl — bootstrap-admin enrollment recovery: replace an unusable unconfirmed secret. */
export async function recoverBootstrapEnrollment(input, req) {
    const { challengeToken, password } = input;
    let payload;
    try {
        payload = verifyChallengeToken(challengeToken);
    }
    catch {
        throw new UnauthorizedError("Invalid or expired challenge", "CHALLENGE_INVALID");
    }
    if (payload.scope !== "mfa_enroll") {
        throw new BadRequestError("Challenge token is not for enrollment recovery");
    }
    const user = await User.findById(payload.sub).select("+passwordHash +totpSecret +totpLastUsedStep");
    if (!user || !user.email || user.role !== "ADMIN") {
        await recordAudit({ action: "BOOTSTRAP_RECOVER_BAD_USER", target: payload.sub, req });
        throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
    }
    const isBootstrapAdmin = user.email.trim().toLowerCase() === "crystal.kanana@strathmore.edu";
    if (!isBootstrapAdmin) {
        await recordAudit({ action: "BOOTSTRAP_RECOVER_NOT_AUTHORIZED", organization: String(user.organization), actor: user._id, target: user._id.toString(), req });
        throw new UnauthorizedError("Recovery is not allowed for this account", "RECOVERY_NOT_ALLOWED");
    }
    if (user.twoFactorEnabled || user.isActive) {
        await recordAudit({ action: "BOOTSTRAP_RECOVER_ALREADY_ACTIVE", organization: String(user.organization), actor: user._id, target: user._id.toString(), req });
        throw new BadRequestError("This account already has two-factor authentication enabled.");
    }
    if (!user.passwordHash) {
        await recordAudit({ action: "BOOTSTRAP_RECOVER_NO_PASSWORD", organization: String(user.organization), actor: user._id, target: user._id.toString(), req });
        throw new BadRequestError("Account setup is incomplete. Use the setup link from your email.");
    }
    const ok = await verifyPassword(user.passwordHash, password);
    if (!ok) {
        await recordAudit({ action: "BOOTSTRAP_RECOVER_BAD_PASSWORD", organization: String(user.organization), actor: user._id, target: user._id.toString(), req });
        throw new UnauthorizedError("Invalid email or password", "INVALID_CREDENTIALS");
    }
    const secret = generateTotpSecret();
    user.totpSecret = encryptSecret(secret);
    user.totpLastUsedStep = undefined;
    await user.save();
    const otpauthUrl = buildOtpAuthUrl(secret, user.email ?? user.name);
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);
    await recordAudit({ action: "BOOTSTRAP_RECOVERED", organization: String(user.organization), actor: user._id, target: user._id.toString(), req });
    return { secret, otpauthUrl, qrDataUrl };
}
/** Step 2c — confirm enrollment with a valid code, then activate 2FA. */
export async function activateTwoFactorEnrollment(challengeToken, code, req) {
    let payload;
    try {
        payload = verifyChallengeToken(challengeToken);
    }
    catch {
        throw new UnauthorizedError("Invalid or expired challenge", "CHALLENGE_INVALID");
    }
    if (payload.scope !== "mfa_enroll") {
        throw new BadRequestError("Challenge token is not for enrollment");
    }
    const user = await User.findById(payload.sub).select("+totpSecret +totpLastUsedStep");
    if (!user || !user.totpSecret) {
        throw new UnauthorizedError("Invalid challenge", "CHALLENGE_INVALID");
    }
    const check = verifyTotp(decryptSecret(user.totpSecret), code, user.totpLastUsedStep);
    if (!check.valid) {
        await recordAudit({ action: "OTP_VERIFY_FAILED", actor: user._id, organization: user.organization, req });
        throw new UnauthorizedError(check.reason === "ALREADY_USED" ? "This code was already used. Wait for the next one." : "Invalid authentication code", "OTP_INVALID");
    }
    if (!(await claimTotpStep(user._id.toString(), check.absoluteStep))) {
        throw new UnauthorizedError("This code was already used. Wait for the next one.", "OTP_INVALID");
    }
    user.twoFactorEnabled = true;
    user.twoFactorConfirmedAt = new Date();
    user.isActive = true;
    await user.save();
    await recordAudit({ action: "2FA_ENROLL_ACTIVATE", actor: user._id, organization: user.organization, req });
    return issueFullSession(user);
}
async function issueFullSession(user) {
    const accessToken = signAccessToken({
        sub: user._id.toString(),
        orgId: user.organization.toString(),
        role: user.role,
    });
    const refreshToken = await issueRefreshToken(user._id.toString(), REFRESH_TTL_DAYS);
    return { status: "authenticated", accessToken, refreshToken, user: toPublicUser(user) };
}
/** Logout — revoke the presented refresh token. */
export async function logout(refreshToken, req) {
    await revokeRefreshToken(refreshToken);
    await recordAudit({ action: "LOGOUT", req });
}
/** Exchange a valid refresh token for a new access token (rotation). */
export async function refresh(rawRefreshToken) {
    const userId = await rotateRefreshTokenSafe(rawRefreshToken);
    const user = await User.findById(userId);
    if (!user || !user.isActive)
        throw new UnauthorizedError("Account unavailable");
    const accessToken = signAccessToken({
        sub: user._id.toString(),
        orgId: user.organization.toString(),
        role: user.role,
    });
    const refreshToken = await issueRefreshToken(user._id.toString(), REFRESH_TTL_DAYS);
    return { accessToken, refreshToken };
}
// Small wrapper so rotateRefreshToken errors map to a clean 401.
async function rotateRefreshTokenSafe(token) {
    const { rotateRefreshToken } = await import("./tokenService.js");
    return rotateRefreshToken(token);
}
/** Load a public user profile by id (for /auth/me). */
export async function getPublicUser(userId) {
    const user = await User.findById(userId);
    if (!user)
        throw new NotFoundError("User not found");
    return toPublicUser(user);
}
/** Admin-triggered 2FA reset: clears 2FA and revokes all sessions. */
export async function resetTwoFactor(userId, actorId, req) {
    const user = await User.findById(userId);
    if (!user)
        throw new NotFoundError("User not found");
    user.twoFactorEnabled = false;
    user.totpSecret = undefined;
    user.twoFactorConfirmedAt = undefined;
    await user.save();
    await revokeAllRefreshTokens(userId);
    await recordAudit({ action: "2FA_RESET", actor: actorId, organization: user.organization, target: userId, req });
}
/** Change own password (requires current password). */
export async function changePassword(userId, currentPassword, newPassword, req) {
    const user = await User.findById(userId).select("+passwordHash");
    if (!user || !user.passwordHash)
        throw new NotFoundError("User not found");
    const ok = await verifyPassword(user.passwordHash, currentPassword);
    if (!ok)
        throw new UnauthorizedError("Current password is incorrect");
    assertPasswordPolicy(newPassword);
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await revokeAllRefreshTokens(userId);
    await recordAudit({ action: "PASSWORD_CHANGE", actor: userId, organization: user.organization, req });
}
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
export async function registerStaff(input, req) {
    const email = normalizeEmail(input.email);
    if (!isGmailAddress(email)) {
        throw new BadRequestError("Staff registration is limited to gmail.com addresses. Use a gmail.com email to create your account.", "EMAIL_DOMAIN_NOT_ALLOWED");
    }
    const org = await Organization.findById(input.organizationId);
    if (!org || !org.isActive) {
        throw new BadRequestError("Select a valid organization.", "ORGANIZATION_INVALID");
    }
    const existing = await User.findOne({ organization: org._id, email });
    if (existing) {
        throw new ConflictError("An account with this email already exists");
    }
    assertPasswordPolicy(input.password);
    const user = await User.create({
        organization: org._id,
        role: "STAFF",
        name: input.name.trim(),
        email,
        passwordHash: await hashPassword(input.password),
        isActive: false,
    });
    await recordAudit({
        action: "STAFF_REGISTER",
        actor: user._id,
        organization: org._id,
        target: user._id.toString(),
        meta: { status: "pending_approval" },
        req,
    });
    // Send a welcome email explaining pending approval. Best-effort: a mail
    // failure must never break registration.
    const welcome = buildWelcomeEmail(user.name, true);
    await sendMail({ to: user.email, subject: welcome.subject, text: welcome.text, html: welcome.html });
    return {
        status: "pending_approval",
        message: "Registration received successfully. Your account is pending administrator approval before you can sign in.",
    };
}
/** Normalize an email for storage and lookup: trimmed + lowercased. */
export function normalizeEmail(email) {
    return email.trim().toLowerCase();
}
/**
 * Current public-registration policy: gmail.com only, exact match.
 * Kept as a named constant so the policy is explicit and reviewable, and
 * easy to replace with per-organization domain lists when the Admin
 * Portal (Phase 4) manages them.
 */
const PUBLIC_REGISTRATION_DOMAIN = "gmail.com";
export function isGmailAddress(email) {
    const at = email.lastIndexOf("@");
    if (at === -1)
        return false;
    return email.slice(at + 1) === PUBLIC_REGISTRATION_DOMAIN;
}
/**
 * Atomically claim a TOTP time-step for a user.
 *
 * The update only succeeds when the step has not been used before, so two
 * concurrent requests presenting the same code cannot both be accepted —
 * MongoDB's document-level atomicity makes the claim a single operation.
 * Returns false when the step was already taken (replay).
 */
async function claimTotpStep(userId, step) {
    const result = await User.updateOne({ _id: userId, $or: [{ totpLastUsedStep: { $exists: false } }, { totpLastUsedStep: { $lt: step } }] }, { $set: { totpLastUsedStep: step } });
    return result.modifiedCount === 1;
}
/* -------------------------------------------------------------------------- */
/* Password reset (staff-only recovery)                                        */
/* -------------------------------------------------------------------------- */
const RESET_TOKEN_BYTES = 32;
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
export async function requestPasswordReset(email, req) {
    const normalized = normalizeEmail(email);
    const user = await User.findOne({ email: normalized, role: "STAFF" }).sort({ createdAt: 1 });
    if (!user) {
        // Unknown / non-staff / admin: identical public response, no token.
        await recordAudit({ action: "PASSWORD_RESET_REQUEST", target: normalized, meta: { sent: false }, req });
        return;
    }
    // Generate a fresh token; supersede any outstanding one for this user.
    const raw = randomToken(RESET_TOKEN_BYTES);
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + config.passwordResetTtlMinutes * 60 * 1000);
    await PasswordResetToken.deleteMany({ user: user._id });
    await PasswordResetToken.create({ user: user._id, tokenHash, expiresAt });
    const resetUrl = `${config.passwordResetBaseUrl}/reset-password?token=${encodeURIComponent(raw)}`;
    const { subject, text, html } = buildResetEmail(resetUrl);
    const delivered = await sendMail({ to: user.email, subject, text, html });
    if (!delivered) {
        // Never leave an undeliverable token usable.
        await PasswordResetToken.deleteOne({ tokenHash });
        await recordAudit({ action: "PASSWORD_RESET_REQUEST", target: normalized, meta: { sent: false }, req });
        return;
    }
    // Audit records only that a reset was sent — never the token or URL.
    await recordAudit({ action: "PASSWORD_RESET_REQUEST", actor: user._id, organization: user.organization, meta: { sent: true }, req });
}
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
export async function resetPassword(token, newPassword, req) {
    const tokenHash = hashToken(token);
    const now = new Date();
    // Atomically claim the token: only succeeds when it is unused AND unexpired.
    const claimed = await PasswordResetToken.findOneAndUpdate({ tokenHash, usedAt: { $exists: false }, expiresAt: { $gt: now } }, { usedAt: now }, { new: true });
    if (!claimed) {
        await recordAudit({ action: "PASSWORD_RESET_FAILED", meta: { reason: "invalid_or_expired" }, req });
        throw new UnauthorizedError("This password-reset link is invalid or has expired.", "RESET_TOKEN_INVALID");
    }
    const user = await User.findById(claimed.user).select("+passwordHash");
    if (!user) {
        // Should not happen (FK), but fail closed and release nothing further.
        throw new UnauthorizedError("This password-reset link is invalid or has expired.", "RESET_TOKEN_INVALID");
    }
    assertPasswordPolicy(newPassword);
    user.passwordHash = await hashPassword(newPassword);
    await user.save();
    await revokeAllRefreshTokens(user._id.toString());
    await recordAudit({ action: "PASSWORD_RESET_SUCCESS", actor: user._id, organization: user.organization, req });
}
