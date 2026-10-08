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

/** Verify a 6-digit TOTP code against a secret. */
export function verifyTotp(secret: string, code: string): boolean {
  try {
    return authenticator.verify({ token: code, secret });
  } catch {
    return false;
  }
}
