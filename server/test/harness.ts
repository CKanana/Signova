/**
 * SIGNOVA-TEST-HARNESS: shared test server + auth helpers.
 *
 * Provides a single Node http.Server configured with the real Express
 * test app (createTestApp) plus the real MongoMemoryServer, so every
 * suite boots the same footprint. Also re-exports the auth helpers.
 *
 * Usage (top of each suite):
 *   import { server, base, startTestServer, stopTestServer } from "./harness.js";
 *   await startTestServer();
 *   ...tests...
 *   await stopTestServer();
 */
import http from "node:http";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

/** Booted server (set by startTestServer). */
export let server: http.Server;

/** Base URL for fetch() calls. */
export let base = "";

/** In-flight MongoMemoryServer instance (for teardown). */
export let mongod: any;

/** Start the in-memory MongoDB + Express HTTP test server. */
export async function startTestServer() {
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  mongod = mem;
  await mongoose.connect(mem.getUri());

  const { createTestApp } = await import("../src/test/app.js");
  server = http.createServer(await createTestApp());
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  base = "http://127.0.0.1:" + server.address().port;
}

/** Stop the test server and disconnect mongoose. */
export async function stopTestServer() {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
}
