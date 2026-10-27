import express, { type Application } from "express";
import { config } from "../config/env.js";
import { securityHeaders, corsMiddleware, bodyLimit } from "../middleware/security.js";
import { requestLogger } from "../middleware/requestLogger.js";
import { apiLimiter } from "../middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "../middleware/error.js";

import authRoutes from "../routes/auth.js";
import organizationRoutes from "../routes/organizations.js";
import tellerRoutes from "../routes/tellers.js";
import sessionRoutes from "../routes/sessions.js";
import messageRoutes from "../routes/messages.js";
import translationRoutes from "../routes/translation.js";
import kioskRoutes from "../routes/kiosk.js";
import staffRoutes from "../routes/staff.js";
import healthRoutes from "../routes/health.js";
import adminRouter from "../admin/index.js";

/**
 * Builds the configured Express application without starting a listener,
 * connecting to a database, or touching process lifecycle.
 *
 * - Same middleware + route surface as the production entrypoint.
 * - Intentionally avoids: database connection, HTTP listener, SIGINT/SIGTERM
 *   handlers, and process.exit.
 * - Socket.IO is NOT wired here; callers that need a live server attach one
 *   themselves via initRealtime (see server/src/index.ts production path).
 */
export function createTestApp(): Application {
  const app = express();

  app.set("trust proxy", 1);

  // Security & parsing middleware
  app.use(securityHeaders());
  app.use(corsMiddleware());
  app.use(bodyLimit());
  app.use(requestLogger());
  app.use(apiLimiter);

  // Health (no auth)
  app.use("/api/health", healthRoutes);

  // API routes
  app.use("/api/auth", authRoutes);
  app.use("/api/organizations", organizationRoutes);
  app.use("/api/tellers", tellerRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/sessions", translationRoutes);
  app.use("/api/sessions/:id/messages", messageRoutes);
  app.use("/api/kiosk", kioskRoutes);
  app.use("/api/staff", staffRoutes);
  // Admin API surface (org-scoped; all routes enforce RBAC server-side).
  app.use("/api/admin", adminRouter);

  // 404 + centralized error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createTestApp;
