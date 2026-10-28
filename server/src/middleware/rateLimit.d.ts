/**
 * Strict limiter for authentication endpoints (login + 2FA verify).
 * Disabled in test mode so the integration suite can exercise the full
 * auth flow without tripping the limit.
 */
export declare const authLimiter: import("express-rate-limit").RateLimitRequestHandler;
/** General limiter for the rest of the API. */
export declare const apiLimiter: import("express-rate-limit").RateLimitRequestHandler;
/**
 * Password-recovery limiters. Separate from the login limiter because the
 * traffic profile differs: forgot-password is prone to enumeration abuse and
 * reset redemption to brute force. Limits are per-IP and generous enough
 * that a shared institutional network isn't locked out. Disabled in test
 * mode (consistent with authLimiter) so the suite can exercise the flow.
 */
export declare const forgotPasswordLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const resetPasswordLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const inviteLimiter: import("express-rate-limit").RateLimitRequestHandler;
export declare const inviteAcceptLimiter: import("express-rate-limit").RateLimitRequestHandler;
