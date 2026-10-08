import morgan from "morgan";
import { config } from "../config/env.js";

/**
 * Request logging. Never logs bodies/headers that could carry secrets
 * (tokens, passwords, OTP codes). Only method/url/status/duration.
 */
export function requestLogger() {
  if (config.isProduction) {
    return morgan("combined");
  }
  return morgan(":method :url :status :response-time ms");
}
