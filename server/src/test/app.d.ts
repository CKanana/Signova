import { type Application } from "express";
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
export declare function createTestApp(): Application;
export default createTestApp;
