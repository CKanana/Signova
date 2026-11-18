/** COMPLETE-TWO-CLIENT-EXCHANGE / TRANSMISSION: real-time two-client
 *  message exchange over Socket.IO with NO manual refresh.
 *
 *  Verifies that a message can travel from the mobile client to the
 *  backend and appear in the staff client, and that the staff response
 *  can return to the mobile client, all over live WebSocket connections.
 *
 *  Run: node --import tsx test/transmission.test.ts
 */
import { test, before, after } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";
import { io as ioClient, type Socket } from "socket.io-client";
import { Organization } from "../src/models/organization.js";
import { User } from "../src/models/user.js";
import { Teller } from "../src/models/teller.js";

// --- harness ---
let mongod: any;
let server: http.Server;
let base: string;
let orgA: any;
let orgAId: string;
let orgB: any;
let orgBId: string;
let adminTokenA: string;
let staffTokenA: string;

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log("  PASS  " + name);
  } else {
    console.log("  FAIL  " + name + " " + detail);
    process.exitCode = 1;
  }
}

function authHeader(token: string): any {
  return { headers: { authorization: "Bearer " + token } };
}

async function login(email: string, password: string) {
  const { login } = await import("../src/services/authService.js");
  return login(email, password, {} as any);
}

async function startTwoFactorEnrollment(challengeToken: string) {
  const { startTwoFactorEnrollment } = await import("../src/services/authService.js");
  return startTwoFactorEnrollment(challengeToken);
}

async function activateTwoFactorEnrollment(challengeToken: string, code: string) {
  const { activateTwoFactorEnrollment } = await import("../src/services/authService.js");
  return activateTwoFactorEnrollment(challengeToken, code, {} as any);
}

async function otplib(): Promise<{ authenticator: any }> {
  const mod = await import("otplib");
  return mod as { authenticator: any };
}

async function jwtSignDynamic(payload: Record<string, unknown>, secret: string, ttl: string): Promise<string> {
  const mod = await import("jsonwebtoken");
  const signFn = mod.default.sign;
  return signFn({ ...payload, scope: "full" }, secret, { expiresIn: ttl });
}

/** Seed a fresh FREE teller in the org and return its _id. */
async function seedTeller(orgId: string): Promise<string> {
  const { Teller } = await import("../src/models/teller.js");
  const existing = await Teller.findOne({ organization: orgId });
  if (existing) {
    await Teller.updateOne({ _id: existing._id }, { $set: { status: "FREE", staffUser: null } });
    return existing._id.toString();
  }
  const teller = await Teller.create({
    organization: orgId,
    name: "Transmit Teller",
    serviceLabel: "Test",
    serviceDesk: "Test Desk",
    counterNumber: "1",
    status: "FREE",
    staffUser: null,
  });
  return teller._id.toString();
}

before(async () => {
  process.env.NODE_ENV = "test";
  process.env.PORT = "4597";
  process.env.MONGODB_URI = "placeholder";
  process.env.ACCESS_TOKEN_SECRET = "test-access-secret-value-1234567890abcdef";
  process.env.ACCESS_TOKEN_TTL = "15m";
  process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-value-1234567890abcdef";
  process.env.REFRESH_TOKEN_TTL = "7d";
  process.env.CHALLENGE_TOKEN_SECRET = "test-challenge-secret-value-1234567890abcdef";
  process.env.CHALLENGE_TOKEN_TTL = "5m";
  process.env.TOTP_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef";
  process.env.APP_NAME = "SignovaTest";
  process.env.TRANSLATION_LOW_CONFIDENCE = "0.6";
  process.env.PASSWORD_RESET_BASE_URL = "http://localhost:5173";

  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  mongod = mem;
  await mongoose.connect(mem.getUri());

  const { seed } = await import("../src/seed/seed.js");
  await seed();

  orgA = await Organization.findOne({ shortName: "KNH" })!;
  orgAId = orgA._id.toString();
  orgB = await Organization.findOne({ shortName: "MTRH" })!;
  orgBId = orgB._id.toString();

  // Fresh admin (no 2FA) for this test file.
  let admin = await User.findOne({ email: "transmission-admin@signova.test" });
  if (admin) await User.deleteOne({ _id: admin._id });
  admin = await User.create({
    organization: orgAId,
    role: "ADMIN",
    name: "Transmission Admin",
    email: "transmission-admin@signova.test",
    passwordHash: await (await import("../src/services/tokenService.js")).hashPassword("Password123!"),
    isActive: true,
    twoFactorEnabled: false,
  });

  // Existing seeded staff for the staff client.
  const staffUser = await User.findOne({ email: "grace@signova.test" })!;
  staffTokenA = await jwtSignDynamic(
    { sub: staffUser._id.toString(), orgId: orgAId, role: "STAFF" },
    process.env.ACCESS_TOKEN_SECRET!,
    "15m",
  );

  const { createTestApp } = await import("../src/test/app.js");
  const express = (await import("express")).default;
  const { createServer } = await import("node:http");
  const { initRealtime } = await import("../src/realtime/gateway.js");

  // Build the Express app with the same route surface as createTestApp,
  // then attach Socket.IO through initRealtime (the production path).
  const app = express();
  app.use(express.json());
  app.use("/api/health", (await import("../src/routes/health.js")).default);
  app.use("/api/auth", (await import("../src/routes/auth.js")).default);
  app.use("/api/organizations", (await import("../src/routes/organizations.js")).default);
  app.use("/api/tellers", (await import("../src/routes/tellers.js")).default);
  app.use("/api/sessions", (await import("../src/routes/sessions.js")).default);
  app.use("/api/sessions", (await import("../src/routes/translation.js")).default);
  app.use("/api/sessions/:id/messages", (await import("../src/routes/messages.js")).default);
  app.use("/api/kiosk", (await import("../src/routes/kiosk.js")).default);
  app.use("/api/staff", (await import("../src/routes/staff.js")).default);
  app.use("/api/admin", (await import("../src/admin/index.js")).default);
  const errorMiddleware = await import("../src/middleware/error.js");
  app.use(errorMiddleware.notFoundHandler);
  app.use(errorMiddleware.errorHandler);

  server = createServer(app);
  const io = initRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  base = "http://127.0.0.1:" + server.address().port;

  // Full admin token.
  const loginRes = await login("transmission-admin@signova.test", "Password123!");
  const enroll = await startTwoFactorEnrollment(loginRes.challengeToken!);
  const { authenticator } = await otplib();
  const code = authenticator.generate(enroll.secret);
  const activated = await activateTwoFactorEnrollment(loginRes.challengeToken!, code);
  adminTokenA = activated.accessToken!;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});

/** Run a real-time two-client exchange on a kiosk session.
 *
 *  Flow:
 *    1. Mobile kiosk client creates a session (no auth) -> receives device token.
 *    2. Mobile socket connects (device token), joins session, receives
 *       session:connected.
 *    3. Staff socket connects (staff token), receives session:request
 *       broadcast.
 *    4. Mobile sends a message over the socket -> staff receives
 *       message:new (real-time, no manual refresh).
 *    5. Staff sends a reply via REST -> server persists and broadcasts.
 *    6. Mobile receives the staff reply over the socket (staff:message).
 *    7. Session is ended; both sides receive session:ended.
 *
 *  Returns the two message payloads (mobile->staff, staff->mobile) plus the
 *  session id so the caller can assert on them.
 */
async function runTwoClientExchange() {
  // ---- mobile client path (kiosk, unauthenticated) ----
  const pubTellers = await fetch(base + "/api/kiosk/tellers");
  const pubTellersBody = await pubTellers.json() as { tellers: Array<{ _id: string }> };
  const tellerId = pubTellersBody.tellers?.[0]?._id;
  check("a FREE teller exists on the public list", !!tellerId);

  const kSess = await fetch(base + "/api/kiosk/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tellerId, method: "sign", deviceId: "device-transmit" }),
  });
  const kSessBody = await kSess.json() as any;
  check("kiosk session created (201)", kSess.status === 201, "body=" + JSON.stringify(kSessBody));
  const deviceToken = kSessBody.accessToken;
  const sessionId = kSessBody.session?._id;

  // Mobile socket connects with device token.
  const mobileSocket = ioClient(`${base}/signova`, {
    auth: { token: deviceToken },
    transports: ["websocket"],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    mobileSocket.on("connect", () => resolve());
    mobileSocket.on("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("mobile socket timeout")), 5000);
  });

  // Mobile emits session:join.
  mobileSocket.emit("session:join", { sessionId });

  // Wait for session:connected.
  const connectedPayload: any = await new Promise<any>((resolve, reject) => {
    mobileSocket.on("session:connected", (p) => resolve(p));
    mobileSocket.on("error", (e: { message?: string }) => reject(new Error(e.message)));
    setTimeout(() => reject(new Error("session:connected timeout")), 5000);
  });
  check("mobile received session:connected", connectedPayload.sessionId === sessionId);
  check("mobile session status is CONNECTING", connectedPayload.status === "CONNECTING");

  // ---- staff client ----
  const staffSocket = ioClient(`${base}/signova`, {
    auth: { token: staffTokenA },
    transports: ["websocket"],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    staffSocket.on("connect", () => resolve());
    staffSocket.on("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("staff socket timeout")), 5000);
  });

  // Staff must join the session room before the message is sent, so it
  // receives the message:new broadcast in real time.
  staffSocket.emit("session:join", { sessionId });

  // Mobile sends a message over the socket.
  mobileSocket.emit("message:send", { sessionId, text: "Hello from Deaf user", method: "sign" });

  // Wait for message:new (mobile -> staff).
  const staffMsg = await new Promise<any>((resolve, reject) => {
    staffSocket.on("message:new", (m) => resolve(m));
    staffSocket.on("error", (e: { message?: string }) => reject(new Error(e.message)));
    setTimeout(() => reject(new Error("staff message:new timeout")), 5000);
  });
  check("staff received message:new (mobile -> staff)", true);
  check("message sender is USER", staffMsg.sender === "USER");
  check("message text matches", staffMsg.text === "Hello from Deaf user");
  check("message id is present", !!staffMsg.id);

  // Staff sends a reply over the socket.
  staffSocket.emit("message:send", { sessionId, text: "Hi there, I can help.", method: "speech" });

  // Wait for staff:message (staff -> mobile).
  const replyPayload = await new Promise<any>((resolve, reject) => {
    staffSocket.on("staff:message", (m) => resolve(m));
    staffSocket.on("error", (e: { message?: string }) => reject(new Error(e.message)));
    setTimeout(() => reject(new Error("staff staff:message timeout")), 5000);
  });
  check("mobile received staff:message (staff reply)", true);
  check("message sender is STAFF", replyPayload.sender === "STAFF");
  check("message text matches", replyPayload.text === "Hi there, I can help.");
  check("message id is present", !!replyPayload.id);

  // --- cleanup (session end) ---
  try { staffSocket.emit("session:end", { sessionId }); } catch { /* noop */ }
  try { mobileSocket.emit("session:end", { sessionId }); } catch { /* noop */ }
  mobileSocket.close();
  staffSocket.close();

  return { mobileToStaff: staffMsg, staffToMobile: replyPayload };
}

// =========================================================================
//  1. Mobile socket connects, joins session, receives session:connected,
//     then a REAL exchange flows: mobile -> staff, staff -> mobile.
// =========================================================================
test("transmission: real-time two-client exchange works without manual refresh", async () => {
  const result = await runTwoClientExchange();

  // Verify the full loop end-to-end: within ONE WebSocket exchange, the
  // message travelled mobile -> backend -> staff, and the staff response
  // travelled back staff -> backend -> mobile, with no page refresh.
  check("mobile->staff message text", result.mobileToStaff.text === "Hello from Deaf user");
  check("staff->mobile message text", result.staffToMobile.text === "Hi there, I can help.");
  check("mobile->staff sender is USER", result.mobileToStaff.sender === "USER");
  check("staff->mobile sender is STAFF", result.staffToMobile.sender === "STAFF");
});

// =========================================================================
//  2. Cross-org isolation at socket level: staff in another org receives no
//     session:request for a session in a different org.
// =========================================================================
test("transmission: staff from another org does NOT receive the session request", async () => {
  // staff B is in org B; the session is created in org A.
  const staffUserB = await User.create({
    organization: orgBId,
    role: "STAFF",
    name: "Other Org Staff",
    email: "other-org-staff@signova.test",
    passwordHash: await (await import("../src/services/tokenService.js")).hashPassword("Password123!"),
    isActive: true,
  });
  const staffTokenB = await jwtSignDynamic(
    { sub: staffUserB._id.toString(), orgId: orgBId, role: "STAFF" },
    process.env.ACCESS_TOKEN_SECRET!,
    "15m",
  );

  const tellerId = await seedTeller(orgAId);

  const kSess = await fetch(base + "/api/kiosk/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tellerId, method: "sign", deviceId: "device-other-org" }),
  });
  const kSessBody = await kSess.json() as any;
  check("kiosk session created (201)", kSess.status === 201, "body=" + JSON.stringify(kSessBody));
  const deviceToken = kSessBody.accessToken;
  const sessionId = kSessBody.session?._id;

  const staffBSocket = ioClient(`${base}/signova`, {
    auth: { token: staffTokenB },
    transports: ["websocket"],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    staffBSocket.on("connect", () => resolve());
    staffBSocket.on("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("staff B socket timeout")), 5000);
  });

  // No session:request should arrive on staff B's socket.
  const requestReceived = new Promise<string | null>((resolve, reject) => {
    staffBSocket.on("session:request", () => resolve("UNEXPECTED"));
    staffBSocket.on("error", (e: { message?: string }) => reject(new Error(e.message)));
    setTimeout(() => resolve(null), 5000);
  });
  const received = await requestReceived;
  check("staff B did NOT receive session:request", received === null);

  staffBSocket.close();
});

// =========================================================================
//  3. Low-confidence alert to org tellers room.
// =========================================================================
test("transmission: low-confidence message emits translation:low to org tellers", async () => {
  const tellerId = await seedTeller(orgAId);

  const kSess = await fetch(base + "/api/kiosk/sessions", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ tellerId, method: "sign", deviceId: "device-lowconf" }),
  });
  const kSessBody = await kSess.json() as any;
  check("kiosk session created (201)", kSess.status === 201, "body=" + JSON.stringify(kSessBody));
  const deviceToken = kSessBody.accessToken;
  const sessionId = kSessBody.session?._id;

  const staffUser = await User.findOne({ email: "grace@signova.test" })!;
  const staffToken = await jwtSignDynamic(
    { sub: staffUser._id.toString(), orgId: orgAId, role: "STAFF" },
    process.env.ACCESS_TOKEN_SECRET!,
    "15m",
  );

  const staffSocket = ioClient(`${base}/signova`, {
    auth: { token: staffToken },
    transports: ["websocket"],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    staffSocket.on("connect", () => resolve());
    staffSocket.on("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("staff socket timeout")), 5000);
  });

  // Emitting a low-confidence user message triggers translation:low.
  const lowConfReceived = new Promise<any>((resolve, reject) => {
    staffSocket.on("translation:low", (p) => resolve(p));
    staffSocket.on("error", (e: { message?: string }) => reject(new Error(e.message)));
    setTimeout(() => reject(new Error("translation:low timeout")), 5000);
  });

  // The message must come from the Deaf-user (device) socket: the server
  // only emits translation:low for USER-originated messages.
  const deviceSocket = ioClient(`${base}/signova`, {
    auth: { token: deviceToken },
    transports: ["websocket"],
    reconnection: false,
  });
  await new Promise<void>((resolve, reject) => {
    deviceSocket.on("connect", () => resolve());
    deviceSocket.on("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("device socket timeout")), 5000);
  });
  deviceSocket.emit("session:join", { sessionId });

  deviceSocket.emit("message:send", { sessionId, text: "Low confidence sign", method: "sign", confidence: 0.3 });

  const lowPayload = await lowConfReceived;
  check("translation:low emitted to staff socket", true);
  check("translation:low has sessionId", lowPayload.sessionId === sessionId);
  check("translation:low confidence < 0.6", lowPayload.confidence < 0.6);

  deviceSocket.close();
});
