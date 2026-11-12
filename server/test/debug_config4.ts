import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  ACCESS_TOKEN_SECRET: z.string().min(16),
});

function loadEnvFromProcessEnv(): z.infer<typeof envSchema> {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid env: ${parsed.error.issues.map((i) => i.message).join(", ")}`);
  }
  return parsed.data as z.infer<typeof envSchema>;
}

function getConfig() {
  const raw = loadEnvFromProcessEnv();
  return {
    jwt: {
      accessSecret: raw.ACCESS_TOKEN_SECRET,
    },
  };
}

// Debug: log when config module is loaded
console.log("[CONFIG DEBUG] Module loaded");
console.log("[CONFIG DEBUG] process.env.ACCESS_TOKEN_SECRET =", process.env.ACCESS_TOKEN_SECRET);

export const config = {
  get env(): string { return getConfig().env; },
  get isProduction(): boolean { return getConfig().isProduction; },
  get port(): number { return getConfig().port; },
  get jwt(): { accessSecret: string } { return getConfig().jwt; },
};

// Debug: log when config getter is accessed
const origJwt = config.jwt;
console.log("[CONFIG DEBUG] config.jwt accessed at module init");
console.log("[CONFIG DEBUG] config.jwt.accessSecret =", config.jwt.accessSecret);
