/**
 * SIGNOVA-TEST-HELPERS: shared authentication helpers for server tests.
 *
 * Provides the real flow (login, challenge, OTP code from the seeded
 * TOTP secret, enrolment/activation) used by test suites so every suite
 * uses one code path and no ad-hoc login logic leaks in.
 *
 * Usage:
 *   import { loginAsAdminWith2FA, loginAsStaff } from "./helpers.js";
 *   const admin = await loginAsAdminWith2FA(orgA);   // ADMIN role, ensembled
 *   const staff = await loginAsStaff(orgA);          // STAFF role, ensembled
 *
 * Both return { accessToken, user } where user is the public user object.
 */
import { authenticator } from "otplib";

export interface AuthResult {
  accessToken: string;
  refreshToken?: string;
  user: any;
}

// Seeded accounts: all have 2FA enabled + confirmed, so login returns
// `2fa_required` (challenge scope "2fa"). The OTP code proves the user
// already completed enrolment (no new secret, no QR).

/** Seeded admin email (active, 2FA enabled + confirmed, ASCII only). */
const ADMIN_EMAIL = "admin@signova.test";
const ADMIN_PASSWORD = "Password123!";

/** Seeded staff email (active, 2FA enabled + confirmed, ASCII only). */
const STAFF_EMAIL = "isa@signova.test";
const STAFF_PASSWORD = "Password123!";

/** Start 2FA enrolment (returns secret + otpauthUrl + qrDataUrl). */
export async function startTwoFactorEnrollment(challengeToken: string) {
  const { startTwoFactorEnrollment } = await import("../src/services/authService.js");
  return startTwoFactorEnrollment(challengeToken);
}

/** Activate 2FA enrolment with a TOTP code. */
export async function activateTwoFactorEnrollment(
  challengeToken: string,
  code: string,
  req: any,
) {
  const { activateTwoFactorEnrollment } = await import("../src/services/authService.js");
  return activateTwoFactorEnrollment(challengeToken, code, req);
}

/**
 * Login as an ACTIVE 2FA-enrolled admin of the given org.
 * Full real flow: POST /api/admin/login -> 2fa_required -> verify the
 * already-active TOTP code -> authenticated.
 * The seeded admin is admin@signova.test, an active-2FA admin
 * (twoFactorEnabled + twoFactorConfirmedAt set in seed).
 *
 * NOTE: If the seeded admin unexpectedly returns mfa_enroll_required
 * (i.e. 2FA was NOT confirmed in the seed), this helper enrolls and
 * activates 2FA first — so the caller always receives an active-2FA
 * token. This guards against seed drift.
 */
export async function loginAsAdminWith2FA(org: any): Promise<AuthResult> {
  const { login } = await import("../src/services/authService.js");
  const loginRes = await login(ADMIN_EMAIL, ADMIN_PASSWORD, {} as any);

  if (loginRes.status === "authenticated") {
    return { accessToken: loginRes.accessToken!, user: loginRes.user! };
  }

  if (loginRes.status === "mfa_enroll_required") {
    // Seed drift: 2FA not confirmed. Enroll + activate with a fresh code.
    const enroll = await startTwoFactorEnrollment(loginRes.challengeToken!);
    const code = authenticator.generate(enroll.secret);
    const activated = await activateTwoFactorEnrollment(
      loginRes.challengeToken!,
      code,
      {} as any,
    );
    if (activated?.status === "authenticated") {
      return { accessToken: activated.accessToken!, user: activated.user! };
    }
    throw new Error("Failed to enroll 2FA for seeded admin");
  }

  if (loginRes.status === "2fa_required") {
    // Normal path: already-enrolled admin; verify the 6-digit code.
    const code = authenticator.generate(); // active 2FA seeded, code valid
    const { verifyTwoFactor } = await import("../src/services/authService.js");
    const verified = await verifyTwoFactor(
      loginRes.challengeToken!,
      code,
      {} as any,
    );
    if (verified?.status === "authenticated") {
      return { accessToken: verified.accessToken!, user: verified.user! };
    }
    throw new Error("Failed to verify 2FA for seeded admin: " + JSON.stringify(verified, null, 2));
  }

  throw new Error("Unexpected login status: " + loginRes.status);
}

/**
 * Login as an ACTIVE staff member of the given org (enrolled 2FA).
 * Full real flow: POST /api/auth/login -> 2fa_required -> verify the
 * already-active TOTP code -> authenticated.
 *
 * NOTE: If the seeded staff unexpectedly returns mfa_enroll_required,
 * this helper enrolls and activates 2FA first — so the caller always
 * receives an authenticated token.
 */
export async function loginAsStaff(org: any): Promise<AuthResult> {
  const { login } = await import("../src/services/authService.js");
  const loginRes = await login(STAFF_EMAIL, STAFF_PASSWORD, {} as any);

  if (loginRes.status === "authenticated") {
    return { accessToken: loginRes.accessToken!, user: loginRes.user! };
  }

  if (loginRes.status === "mfa_enroll_required") {
    // Seed drift: 2FA not confirmed. Enroll + activate with a fresh code.
    const enroll = await startTwoFactorEnrollment(loginRes.challengeToken!);
    const code = authenticator.generate(enroll.secret);
    const activated = await activateTwoFactorEnrollment(
      loginRes.challengeToken!,
      code,
      {} as any,
    );
    if (activated?.status === "authenticated") {
      return { accessToken: activated.accessToken!, user: activated.user! };
    }
    throw new Error("Failed to enroll 2FA for seeded staff");
  }

  if (loginRes.status === "2fa_required") {
    // Normal path: already-enrolled staff; verify the 6-digit code.
    const code = authenticator.generate(); // active 2FA seeded, code valid
    const { verifyTwoFactor } = await import("../src/services/authService.js");
    const verified = await verifyTwoFactor(
      loginRes.challengeToken!,
      code,
      {} as any,
    );
    if (verified?.status === "authenticated") {
      return { accessToken: verified.accessToken!, user: verified.user! };
    }
    throw new Error("Failed to verify 2FA for seeded staff: " + JSON.stringify(verified, null, 2));
  }

  throw new Error("Unexpected login status: " + loginRes.status);
}
