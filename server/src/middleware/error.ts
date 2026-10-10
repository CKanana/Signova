import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/errors.js";
import { config } from "../config/env.js";
import { ZodError } from "zod";

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { code: "NOT_FOUND", message: `Route ${req.method} ${req.path} not found` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  // Zod validation errors → 400 with safe field details.
  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request",
        details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
    });
    return;
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        // Prefer the specific error code so clients can branch on it
        // (e.g. EMAIL_DOMAIN_NOT_ALLOWED); fall back to the generic code.
        code: typeof err.details === "string" ? err.details : err.code,
        message: err.message,
        ...(err.details && typeof err.details !== "string" ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unknown errors: log detail server-side only, return generic message.
  // eslint-disable-next-line no-console
  console.error("[error]", err);
  res.status(500).json({
    error: {
      code: "INTERNAL_ERROR",
      message: config.isProduction ? "Internal server error" : (err as Error).message,
    },
  });
}
