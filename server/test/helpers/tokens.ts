/** SIGNOVA-TEST-TOKENS: mint access tokens for seeded users without 2FA flow.
 *
 * Usage:
 *   import { tokenFor } from "./tokens.js";
 *   const adminToken = await tokenFor({ email: "admin@signova.test", org: orgAId });
 *
 * Mints a full-scope "full" JWT access token using the same signAccessToken
 * function the real login uses. No login, no 2FA, no OTP, no seed drift.
 *
 * NOTE: config.ts is cached at module load time and is read with the dev or
 * whatever env was set when it was first imported. This helper therefore
 * reads the signing secret directly from process.env.ACCESS_TOKEN_SECRET
 * (set in the test before() hook) so it always picks up the test env.
 */
import type { Role } from "../../shared/types/translation.js";
import crypto from "node:crypto";

export interface TokenForArgs {
  email: string;
  org: string;
  role: Role;
}

/** Mint a full-scope access token for a seeded user (no login, no 2FA). */
export async function tokenFor(args: TokenForArgs): Promise<string> {
  const { email, org, role } = args;

  // Load the User model we need (no config dependency).
  const { User } = await import("../../src/models/user.js");

  const user = await User.findOne({ email }).select("+passwordHash");
  if (!user) {
    throw new Error(`User not found: ${email}`);
  }

  const payload = {
    sub: user._id.toString(),
    orgId: org,
    role,
    scope: "full",
  };

  // Use the same secret and TTL the real login uses, read from env at call
  // time so the test env (set in before()) is always picked up.
  const secret = process.env.ACCESS_TOKEN_SECRET;
  if (!secret) {
    throw new Error("ACCESS_TOKEN_SECRET not set (set in test before() hook)");
  }
  const ttl = process.env.ACCESS_TOKEN_TTL ?? "15m";

  // jsonwebtoken is loaded dynamically to avoid config import caching.
  // Under tsx the module's default export is { sign, verify, decode, ... }.
  const signFn = (await import("jsonwebtoken")).default.sign;
  return signFn(payload, secret, { expiresIn: ttl });
}
