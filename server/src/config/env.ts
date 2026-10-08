import "dotenv/config";
import { z } from "zod";

/**
 * Centralized, validated environment configuration.
 * Fails fast at boot if anything required is missing or malformed,
 * so the server never runs with insecure defaults.
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
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    // eslint-disable-next-line no-console
    console.error(`Invalid environment configuration:\n${issues}`);
    process.exit(1);
  }
  return parsed.data;
}

const env = loadEnv();

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
} as const;
