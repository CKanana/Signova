import { authenticator } from "otplib";
import { config } from "../config/env.js";
authenticator.options = { window: 1, step: 30, digits: 6 };
/** Generate a new base32 TOTP secret for enrollment. */
export function generateTotpSecret() {
    return authenticator.generateSecret();
}
/** Build the otpauth:// URI shown/encoded in the enrollment QR code. */
export function buildOtpAuthUrl(secret, accountEmail) {
    return authenticator.keyuri(accountEmail, config.appName, secret);
}
/**
 * Verify a 6-digit TOTP code against a secret, rejecting replay.
 *
 * `lastUsedStep` is the step of the previously accepted code (undefined
 * for a fresh account). A code is accepted only when it matches AND its
 * absolute step has not been used before. Because time only moves forward,
 * this also naturally rejects codes older than the verification window.
 */
export function verifyTotp(secret, code, lastUsedStep) {
    try {
        const delta = authenticator.checkDelta(code, secret);
        if (typeof delta !== "number")
            return { valid: false, reason: "INVALID_CODE" };
        const absoluteStep = currentTotpStep() + delta;
        if (lastUsedStep !== undefined && absoluteStep <= lastUsedStep) {
            return { valid: false, reason: "ALREADY_USED" };
        }
        return { valid: true, absoluteStep };
    }
    catch {
        return { valid: false, reason: "INVALID_CODE" };
    }
}
/** The current absolute 30-second TOTP step (UTC epoch). */
export function currentTotpStep() {
    return Math.floor(Date.now() / 1000 / (authenticator.options.step ?? 30));
}
//# sourceMappingURL=totp.js.map