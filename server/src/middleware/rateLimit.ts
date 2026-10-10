import rateLimit from "express-rate-limit";
import { TooManyRequestsError } from "../utils/errors.js";
import { config } from "../config/env.js";

/**
 * Strict limiter for authentication endpoints (login + 2FA verify).
 * Disabled in test mode so the integration suite can exercise the full
 * auth flow without tripping the limit.
 */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: config.isProduction ? 10 : 10000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === "test",
  handler: () => {
    throw new TooManyRequestsError("Too many authentication attempts. Try again later.");
  },
});

/** General limiter for the rest of the API. */
export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password-recovery limiters. Separate from the login limiter because the
 * traffic profile differs: forgot-password is prone to enumeration abuse and
 * reset redemption to brute force. Limits are per-IP and generous enough
 * that a shared institutional network isn't locked out. Disabled in test
 * mode (consistent with authLimiter) so the suite can exercise the flow.
 */
export const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === "test",
  handler: () => {
    throw new TooManyRequestsError("Too many password-reset requests. Try again later.");
  },
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10, // per IP per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => config.env === "test",
  handler: () => {
    throw new TooManyRequestsError("Too many attempts. Try again later.");
  },
});
