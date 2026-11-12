import "dotenv/config";
import { z } from "zod";
/** @file Centralized, validated environment configuration.
 * Fails fast at boot if anything required is missing or malformed,
 * so the server never runs with insecure defaults.
 *
 * Base URLs are explicit, absolute, and trusted (never derived from the
 * request Host header). They are used to build every emailed link so that a
 * real invite email always contains a valid absolute URL.
 */
const envSchema = z.object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().default(4000),
    CORS_ORIGINS: z.string().default("http://localhost:5173,http://localhost:5174,http://localhost:8081"),
    MONGODB_URI: z.string().url("MONGODB_URI must be a valid connection string"),
    ACCESS_TOKEN_SECRET: z.string().min(16, "ACCESS_TOKEN_SECRET must be at least 16 chars"),
    ACCESS_TOKEN_TTL: z.string().default("15m"),
    REFRESH_TOKEN_SECRET: z.string().min(16, "REFRESH_TOKEN_SECRET must be at least 16 chars"),
    REFRESH_TOKEN_TTL: z.string().default("7d"),
    CHALLENGE_TOKEN_SECRET: z.string().min(16, "CHALLENGE_TOKEN_SECRET must be at least 16 chars"),
    CHALLENGE_TOKEN_TTL: z.string().default("5m"),
    // 32-byte key for AES-256-GCM (hex-encoded = 64 chars, or base64)
    TOTP_ENCRYPTION_KEY: z.string().min(32, "TOTP_ENCRYPTION_KEY must be at least 32 chars"),
    APP_NAME: z.string().default("Signova"),
    TRANSLATION_LOW_CONFIDENCE: z.coerce.number().min(0).max(1).default(0.6),
    // Optional: pin the organization served to mobile kiosks when more than
    // one organization exists in the database. Falls back to the first active org.
    SIGNOVA_ORG_ID: z.string().optional(),
    // --- Password-reset email (Gmail SMTP) — all optional at boot ---
    // If unconfigured, the server runs normally but cannot deliver reset
    // emails; the forgot-password endpoint fails safely without them.
    SMTP_HOST: z.string().default("smtp.gmail.com"),
    SMTP_PORT: z.coerce.number().int().positive().default(587),
    SMTP_USER: z.string().optional(),
    SMTP_APP_PASSWORD: z.string().optional(),
    // Base URL of the admin portal, used to build bootstrap setup links.
    // Must be a trusted value (never derived from the request Host header).
    ADMIN_PORTAL_URL: z.string().default("http://localhost:5174"),
    // Base URL of the staff web app, used to build password-reset links.
    PASSWORD_RESET_BASE_URL: z.string().default("http://localhost:5173"),
    // Base URL of the staff web app, used to build invitation/setup links.
    // The public-facing origin the admin sends invites to; used by the email
    // template to produce an absolute URL.
    APP_PUBLIC_BASE_URL: z.string().default("http://localhost:5173"),
    // Reset-token lifetime in minutes (target: 15).
    PASSWORD_RESET_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    // ---- Google OAuth (OpenID Connect) credentials ----
    // Never expose these in frontend code. Configure via the Google Cloud
    // Console: IAM & Admin → Credentials → OAuth 2.0 Client IDs. The
    // redirect URI for the web apps is the value of APP_PUBLIC_BASE_URL.
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
    // Single-source bootstrap setup token TTL.
    BOOTSTRAP_SETUP_TOKEN_TTL_MS: z.number().int().positive().default(10 * 60 * 1000),
});
/** Schema to validate the current process env vars. Reads process.env at
 * call time so tests that mutate process.env before importing config can
 * still pick up the correct values (the config object is cached, so this
 * returns a fresh validation on each call). */
function loadEnvFromProcessEnv() {
    const parsed = envSchema.safeParse(process.env);
    if (!parsed.success) {
        const issues = parsed.error.issues
            .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
            .join("\n");
        throw new Error(`Invalid environment configuration:\n${issues}`);
    }
    return parsed.data;
}
// Re-validate and re-derive the config on every access. Env vars may have
// changed since the last access (e.g. a test set process.env before importing
// config). This is slightly more costly than a plain cached object but keeps
// test and production behaviour correct.
function getConfig() {
    const raw = loadEnvFromProcessEnv();
    // --- Absolute-URL validation (explicitly constructed, not concatenated) ---
    const urlKeys = ["APP_PUBLIC_BASE_URL", "ADMIN_PORTAL_URL"];
    const problems = [];
    for (const key of urlKeys) {
        const value = raw[key];
        if (!value) {
            problems.push(`${key} is missing`);
            continue;
        }
        if (!_isAbsoluteUrl(String(value))) {
            problems.push(`${key} is not an absolute URL: ${value}`);
        }
    }
    if (problems.length) {
        throw new Error("[config] Invalid base URL configuration:\n  - " + problems.join("\n  - "));
    }
    // --- Production: https required for every emailed-link base URL ---
    if (raw.NODE_ENV === "production") {
        for (const key of urlKeys) {
            try {
                const u = new URL(String(raw[key]));
                if (u.protocol !== "https:") {
                    throw new Error(`[config] ${key} must use https: in production (got ${u.protocol})`);
                }
            }
            catch {
                // _isAbsoluteUrl already returned false above
            }
        }
    }
    // --- Development: log a warning when a localhost default is in use ---
    if (raw.NODE_ENV === "development") {
        try {
            const staff = new URL(String(raw.APP_PUBLIC_BASE_URL));
            if (staff.hostname === "localhost") {
                console.warn(`[config] APP_PUBLIC_BASE_URL is http://localhost:${staff.port || 80} in development — confirm it points at the Staff app.`);
            }
        }
        catch {
            // already reported above
        }
        try {
            const admin = new URL(String(raw.ADMIN_PORTAL_URL));
            if (admin.hostname === "localhost") {
                console.warn(`[config] ADMIN_PORTAL_URL is http://localhost:${admin.port || 80} in development — confirm it points at the Admin portal.`);
            }
        }
        catch {
            // already reported above
        }
    }
    return {
        env: raw.NODE_ENV,
        isProduction: raw.NODE_ENV === "production",
        port: raw.PORT,
        corsOrigins: raw.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
        mongodbUri: raw.MONGODB_URI,
        jwt: {
            accessSecret: raw.ACCESS_TOKEN_SECRET,
            accessTtl: raw.ACCESS_TOKEN_TTL,
            refreshSecret: raw.REFRESH_TOKEN_SECRET,
            refreshTtl: raw.REFRESH_TOKEN_TTL,
            challengeSecret: raw.CHALLENGE_TOKEN_SECRET,
            challengeTtl: raw.CHALLENGE_TOKEN_TTL,
        },
        totpEncryptionKey: raw.TOTP_ENCRYPTION_KEY,
        appName: raw.APP_NAME,
        lowConfidenceThreshold: raw.TRANSLATION_LOW_CONFIDENCE,
        orgId: raw.SIGNOVA_ORG_ID,
        smtp: {
            host: raw.SMTP_HOST.trim(),
            port: raw.SMTP_PORT,
            user: raw.SMTP_USER?.trim(),
            appPassword: raw.SMTP_APP_PASSWORD ? raw.SMTP_APP_PASSWORD.replace(/\s+/g, "") : undefined,
        },
        adminPortalUrl: raw.ADMIN_PORTAL_URL.trim().replace(/\/+$/, ""),
        passwordResetBaseUrl: raw.PASSWORD_RESET_BASE_URL.trim().replace(/\/+$/, ""),
        appPublicBaseUrl: raw.APP_PUBLIC_BASE_URL.trim().replace(/\/+$/, ""),
        passwordResetTtlMinutes: raw.PASSWORD_RESET_TTL_MINUTES,
        BOOTSTRAP_SETUP_TOKEN_TTL_MS: raw.BOOTSTRAP_SETUP_TOKEN_TTL_MS,
        google: {
            clientId: raw.GOOGLE_CLIENT_ID,
            clientSecret: raw.GOOGLE_CLIENT_SECRET,
        },
    };
}
function _isAbsoluteUrl(value) {
    try {
        const u = new URL(value);
        return typeof u.hostname === "string" && u.hostname.length > 0;
    }
    catch {
        return false;
    }
}
// Module-level config object. Each getter re-reads env vars from process.env
// at call time via getConfig(), so tests that mutate process.env before
// importing config can still pick up the correct values. This avoids the
// module-load-time caching that broke tests earlier.
export const config = {
    get env() { return getConfig().env; },
    get isProduction() { return getConfig().isProduction; },
    get port() { return getConfig().port; },
    get corsOrigins() { return getConfig().corsOrigins; },
    get mongodbUri() { return getConfig().mongodbUri; },
    get jwt() { return getConfig().jwt; },
    get totpEncryptionKey() { return getConfig().totpEncryptionKey; },
    get appName() { return getConfig().appName; },
    get lowConfidenceThreshold() { return getConfig().lowConfidenceThreshold; },
    get orgId() { return getConfig().orgId; },
    get smtp() { return getConfig().smtp; },
    get adminPortalUrl() { return getConfig().adminPortalUrl; },
    get passwordResetBaseUrl() { return getConfig().passwordResetBaseUrl; },
    get appPublicBaseUrl() { return getConfig().appPublicBaseUrl; },
    get passwordResetTtlMinutes() { return getConfig().passwordResetTtlMinutes; },
    get BOOTSTRAP_SETUP_TOKEN_TTL_MS() { return getConfig().BOOTSTRAP_SETUP_TOKEN_TTL_MS; },
    get google() { return getConfig().google; },
};
// Single-source bootstrap setup token TTL, exported for scripts and services.
export const BOOTSTRAP_SETUP_TOKEN_TTL_MS = config.BOOTSTRAP_SETUP_TOKEN_TTL_MS;
