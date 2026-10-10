import { authenticator } from "otplib";
import { config } from "../config/env.js";

authenticator.options = { window: 1, step: 30, digits: 6 };

/** Generate a new base32 TOTP secret for enrollment. */
export function generateTotpSecret(): string {
  return authenticator.generateSecret();
}

/** Build the otpauth:// URI shown/encoded in the enrollment QR code. */
export function buildOtpAuthUrl(secret: string, accountEmail: string): string {
  return authenticator.keyuri(accountEmail, config.appName, secret);
}

/**
 * Outcome of a TOTP verification attempt.
 *
 * `absoluteStep` is the counter value that produced the code (the current
 * 30-second step plus the window delta). Callers persist it so the same
 * step can never be accepted twice — see authService.claimTotpStep.
 */
export type TotpCheck =
  | { valid: false; reason: "INVALID_CODE" | "ALREADY_USED" }
  | { valid: true; absoluteStep: number };

/**
 * Verify a 6-digit TOTP code against a secret, rejecting replay.
 *
 * `lastUsedStep` is the step of the previously accepted code (undefined
 * for a fresh account). A code is accepted only when it matches AND its
 * absolute step has not been used before. Because time only moves forward,
 * this also naturally rejects codes older than the verification window.
 */
export function verifyTotp(secret: string, code: string, lastUsedStep?: number): TotpCheck {
  try {
    const delta = authenticator.checkDelta(code, secret);
    if (typeof delta !== "number") return { valid: false, reason: "INVALID_CODE" };

    const absoluteStep = currentTotpStep() + delta;
    if (lastUsedStep !== undefined && absoluteStep <= lastUsedStep) {
      return { valid: false, reason: "ALREADY_USED" };
    }
    return { valid: true, absoluteStep };
  } catch {
    return { valid: false, reason: "INVALID_CODE" };
  }
}

/** The current absolute 30-second TOTP step (UTC epoch). */
export function currentTotpStep(): number {
  return Math.floor(Date.now() / 1000 / (authenticator.options.step ?? 30));
}
