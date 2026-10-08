import express from "express";
import { createServer } from "node:http";
import { config } from "./config/env.js";
import { connectDatabase, disconnectDatabase } from "./config/db.js";
import { securityHeaders, corsMiddleware, bodyLimit } from "./middleware/security.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { apiLimiter } from "./middleware/rateLimit.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { initRealtime } from "./realtime/gateway.js";

import authRoutes from "./routes/auth.js";
import organizationRoutes from "./routes/organizations.js";
import tellerRoutes from "./routes/tellers.js";
import sessionRoutes from "./routes/sessions.js";
import messageRoutes from "./routes/messages.js";
import translationRoutes from "./routes/translation.js";
import kioskRoutes from "./routes/kiosk.js";
import staffRoutes from "./routes/staff.js";
import healthRoutes from "./routes/health.js";

async function main() {
  await connectDatabase();

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

  // 404 + centralized error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  // HTTP + Socket.IO
  const httpServer = createServer(app);
  initRealtime(httpServer);

  httpServer.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`[server] Signova API listening on http://localhost:${config.port}`);
    // eslint-disable-next-line no-console
    console.log(`[server] environment: ${config.env}`);
  });

  // Graceful shutdown
  const shutdown = async (signal: string) => {
    // eslint-disable-next-line no-console
    console.log(`\n[server] ${signal} received, shutting down`);
    httpServer.close(async () => {
      await disconnectDatabase();
      process.exit(0);
    });
    // Force-exit if close hangs
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[server] fatal startup error:", err);
  process.exit(1);
});
