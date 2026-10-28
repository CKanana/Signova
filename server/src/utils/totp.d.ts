/** Generate a new base32 TOTP secret for enrollment. */
export declare function generateTotpSecret(): string;
/** Build the otpauth:// URI shown/encoded in the enrollment QR code. */
export declare function buildOtpAuthUrl(secret: string, accountEmail: string): string;
/**
 * Outcome of a TOTP verification attempt.
 *
 * `absoluteStep` is the counter value that produced the code (the current
 * 30-second step plus the window delta). Callers persist it so the same
 * step can never be accepted twice — see authService.claimTotpStep.
 */
export type TotpCheck = {
    valid: false;
    reason: "INVALID_CODE" | "ALREADY_USED";
} | {
    valid: true;
    absoluteStep: number;
};
/**
 * Verify a 6-digit TOTP code against a secret, rejecting replay.
 *
 * `lastUsedStep` is the step of the previously accepted code (undefined
 * for a fresh account). A code is accepted only when it matches AND its
 * absolute step has not been used before. Because time only moves forward,
 * this also naturally rejects codes older than the verification window.
 */
export declare function verifyTotp(secret: string, code: string, lastUsedStep?: number): TotpCheck;
/** The current absolute 30-second TOTP step (UTC epoch). */
export declare function currentTotpStep(): number;
