import helmet from "helmet";
import cors from "cors";
import express from "express";
import { config } from "../config/env.js";

/** Secure HTTP headers. */
export function securityHeaders() {
  return helmet({
    contentSecurityPolicy: config.isProduction ? undefined : false,
    crossOriginResourcePolicy: { policy: "cross-origin" },
  });
}

/** CORS with an allowlist from env. */
export function corsMiddleware() {
  return cors({
    origin(origin, callback) {
      // Allow same-origin / non-browser (curl, mobile native) requests.
      if (!origin) return callback(null, true);
      if (config.corsOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  });
}

/** JSON body size limit. */
export function bodyLimit() {
  return express.json({ limit: "1mb" });
}
