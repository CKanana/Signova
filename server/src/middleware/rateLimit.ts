import rateLimit from "express-rate-limit";
import { TooManyRequestsError } from "../utils/errors.js";

/** Strict limiter for authentication endpoints (login + 2FA verify). */
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
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
