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

  // Single-source bootstrap setup token TTL.
  BOOTSTRAP_SETUP_TOKEN_TTL_MS: z.number().int().positive().default(10 * 60 * 1000),
});

function _isAbsoluteUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return typeof u.hostname === "string" && u.hostname.length > 0;
  } catch {
    return false;
  }
}

function _loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }

  const raw = parsed.data as z.infer<typeof envSchema>;

  // --- Absolute-URL validation (explicitly constructed, not concatenated) ---
  const urlKeys: (keyof typeof raw)[] = ["APP_PUBLIC_BASE_URL", "ADMIN_PORTAL_URL"];
  const problems: string[] = [];
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
    // eslint-disable-next-line no-console
    console.error("[config] Invalid base URL configuration:\n  - " + problems.join("\n  - "));
    process.exit(1);
  }

  // --- Production: https required for every emailed-link base URL ---
  if (raw.NODE_ENV === "production") {
    for (const key of urlKeys) {
      try {
        const u = new URL(String(raw[key]));
        if (u.protocol !== "https:") {
          // eslint-disable-next-line no-console
          console.error(
            `[config] ${key} must use https: in production (got ${u.protocol})`,
          );
          process.exit(1);
        }
      } catch (err) {
        // _isAbsoluteUrl already returned false above
      }
    }
  }

  // --- Development: log a warning when a localhost default is in use ---
  if (raw.NODE_ENV === "development") {
    try {
      const staff = new URL(String(raw.APP_PUBLIC_BASE_URL));
      if (staff.hostname === "localhost") {
        // eslint-disable-next-line no-console
        console.warn(
          `[config] APP_PUBLIC_BASE_URL is http://localhost:${staff.port || 80} in development — confirm it points at the Staff app.`,
        );
      }
    } catch {
      // already reported above
    }
    try {
      const admin = new URL(String(raw.ADMIN_PORTAL_URL));
      if (admin.hostname === "localhost") {
        // eslint-disable-next-line no-console
        console.warn(
          `[config] ADMIN_PORTAL_URL is http://localhost:${admin.port || 80} in development — confirm it points at the Admin portal.`,
        );
      }
    } catch {
      // already reported above
    }
  }

  return raw;
}

const env = _loadEnv();

export const config = {
  env: env.NODE_ENV,
  isProduction: env.NODE_ENV === "production",
  port: env.PORT,
  corsOrigins: env.CORS_ORIGINS.split(",").map((o) => o.trim()).filter(Boolean),
  mongodbUri: env.MONGODB_URI,
  jwt: {
    accessSecret: env.ACCESS_TOKEN_SECRET,
    accessTtl: env.ACCESS_TOKEN_TTL,
    refreshSecret: env.REFRESH_TOKEN_SECRET,
    refreshTtl: env.REFRESH_TOKEN_TTL,
    challengeSecret: env.CHALLENGE_TOKEN_SECRET,
    challengeTtl: env.CHALLENGE_TOKEN_TTL,
  },
  totpEncryptionKey: env.TOTP_ENCRYPTION_KEY,
  appName: env.APP_NAME,
  lowConfidenceThreshold: env.TRANSLATION_LOW_CONFIDENCE,
  orgId: env.SIGNOVA_ORG_ID,
  smtp: {
    host: env.SMTP_HOST.trim(),
    port: env.SMTP_PORT,
    user: env.SMTP_USER?.trim(),
    appPassword: env.SMTP_APP_PASSWORD ? env.SMTP_APP_PASSWORD.replace(/\s+/g, "") : undefined,
  },
  adminPortalUrl: env.ADMIN_PORTAL_URL.trim().replace(/\/+$/, ""),
  passwordResetBaseUrl: env.PASSWORD_RESET_BASE_URL.trim().replace(/\/+$/, ""),
  appPublicBaseUrl: env.APP_PUBLIC_BASE_URL.trim().replace(/\/+$/, ""),
  passwordResetTtlMinutes: env.PASSWORD_RESET_TTL_MINUTES,
  BOOTSTRAP_SETUP_TOKEN_TTL_MS: env.BOOTSTRAP_SETUP_TOKEN_TTL_MS,
} as const;

// Single-source bootstrap setup token TTL, exported for scripts and services.
export const BOOTSTRAP_SETUP_TOKEN_TTL_MS = config.BOOTSTRAP_SETUP_TOKEN_TTL_MS;
