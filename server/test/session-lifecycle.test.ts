/**
 * SESSION LIFECYCLE: Phase 1 acceptance workflow verification.
 *
 * Boots the real Express app + Socket.IO against an in-memory MongoDB and
 * exercises the server-controlled acceptance workflow:
 *
 *   1. Deaf user creates a session request -> CONNECTING, teller RESERVED (not BUSY)
 *   2. Teller reservation blocks a second request on the same teller (409)
 *   3. Authorized accept -> ACTIVE, teller BUSY
 *   4. Authorized reject -> CANCELLED, teller FREE
 *   5. Reservation release (session end / stuck-teller reconcile)
 *   6. Unauthorized acceptance rejected (unrelated staff, Deaf user)
 *   7. Duplicate accept/reject are safe and idempotent
 *   8. Socket.IO: staff socket receives session:request on creation
 *
 * Run: node --test --import tsx test/session-lifecycle.test.ts
 */

import { test, before, after } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";
import { io as ioClient, type Socket } from "socket.io-client";
import { C2S, S2C_MOBILE, S2C_STAFF } from "../src/realtime/events.js";

process.env.NODE_ENV = "test";
process.env.PORT = "4597";
process.env.MONGODB_URI = "placeholder";
process.env.ACCESS_TOKEN_SECRET = "test-access-secret-value-1234567890abcdef";
process.env.ACCESS_TOKEN_TTL = "15m";
process.env.REFRESH_TOKEN_SECRET = "test-refresh-secret-value-1234567890abcdef";
process.env.REFRESH_TOKEN_TTL = "7d";
process.env.CHALLENGE_TOKEN_SECRET = "test-challenge-secret-value-1234567890abcdef";
process.env.CHALLENGE_TOKEN_TTL = "5m";
process.env.TOTP_ENCRYPTION_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
process.env.APP_NAME = "SignovaTest";
process.env.TRANSLATION_LOW_CONFIDENCE = "0.6";

let mongod: any;
let server: http.Server;
let base: string;

let orgA: any;
let tellerA: any; // KNH01, assigned to Grace (staff)
let tellerB: any; // KNH02, assigned to Brian (staff)
let tellerC: any; // KNH03, assigned to Njeri (staff)
let graceToken: string; // STAFF, assigned to tellerA
let brianToken: string; // STAFF, assigned to tellerB
let njeriToken: string; // STAFF, assigned to tellerC
let deviceToken: string; // DEAF_USER device

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(`${name}: ${detail}`);
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

function authHeader(token: string): HeadersInit {
  return { headers: { authorization: `Bearer ${token}` } };
}

async function j(path: string, opts: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

async function once(emitter: NodeJS.EventEmitter, event: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    emitter.once(event, resolve);
    emitter.once("error", reject);
    setTimeout(() => reject(new Error(`timeout waiting for ${event}`)), 10000);
  });
}

/** Full staff login (2FA enroll/activate if needed, then verify). */
async function loginWith2FA(email: string, password: string): Promise<string> {
  const { login } = await import("../src/services/authService.js");
  const {
    startTwoFactorEnrollment,
    activateTwoFactorEnrollment,
    verifyTwoFactor,
  } = await import("../src/services/authService.js");
  const { authenticator } = await import("otplib");

  const loginRes = await login(email, password, {} as any);
  if (loginRes.status === "authenticated") return loginRes.accessToken!;

  if (loginRes.status === "mfa_enroll_required") {
    const enroll = await startTwoFactorEnrollment(loginRes.challengeToken!);
    const code = authenticator.generate(enroll.secret);
    const activated = await activateTwoFactorEnrollment(loginRes.challengeToken!, code, {} as any);
    return activated.accessToken!;
  }

  if (loginRes.status === "2fa_required") {
    const code = authenticator.generate();
    const verified = await verifyTwoFactor(loginRes.challengeToken!, code, {} as any);
    return verified.accessToken!;
  }
  throw new Error(`Unexpected login status for ${email}: ${JSON.stringify(loginRes)}`);
}

async function models() {
  const [TellerMod, SessionMod] = await Promise.all([
    import("../src/models/teller.js"),
    import("../src/models/session.js"),
  ]);
  return { Teller: TellerMod.Teller, Session: SessionMod.Session };
}

before(async () => {
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  mongod = mem;
  await mongoose.connect(mem.getUri());

  const { seed } = await import("../src/seed/seed.js");
  await seed();

  const express = (await import("express")).default;
  const { createServer } = await import("node:http");
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
  const { errorHandler, notFoundHandler } = await import("../src/middleware/error.js");
  app.use(notFoundHandler);
  app.use(errorHandler);

  const { initRealtime } = await import("../src/realtime/gateway.js");
  server = createServer(app);
  initRealtime(server);
  await new Promise<void>((resolve) => server.listen(0, () => resolve()));
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;

  const { Organization } = await import("../src/models/organization.js");
  const { Teller } = await import("../src/models/teller.js");
  orgA = await Organization.findOne({ shortName: "KNH" })!;
  tellerA = await Teller.findOne({ organization: orgA._id, pairingCode: "KNH01" })!;
  tellerB = await Teller.findOne({ organization: orgA._id, pairingCode: "KNH02" })!;
  tellerC = await Teller.findOne({ organization: orgA._id, pairingCode: "KNH03" })!;

  graceToken = await loginWith2FA("grace@signova.test", "Password123!");
  brianToken = await loginWith2FA("brian@signova.test", "Password123!");
  njeriToken = await loginWith2FA("njeri@signova.test", "Password123!");

  const { signAccessToken } = await import("../src/utils/jwt.js");
  const { User } = await import("../src/models/user.js");
  // ensureDeafUser keys on phone=deviceId=auth.sub and returns that user's _id,
  // which becomes session.deafUser. So auth.sub must equal session.deafUser.
  const deviceUser = await User.create({
    organization: orgA._id,
    role: "DEAF_USER",
    name: "Device User",
    phone: "placeholder",
  });
  await User.updateOne({ _id: deviceUser._id }, { phone: deviceUser._id.toString() });
  deviceToken = signAccessToken({
    sub: deviceUser._id.toString(),
    orgId: orgA._id.toString(),
    role: "DEAF_USER",
  });
});

after(async () => {
  console.log(`\nRESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) failures.forEach((f) => console.log(`  - ${f}`));
  process.exitCode = failed === 0 ? 0 : 1;
  process.exit(process.exitCode);
});

// ------------------------------------------------------------------
// 14-21. Socket.IO acceptance/rejection flow + reconnection recovery
// ------------------------------------------------------------------

/** Connect a staff socket and wait for it to be ready. */
async function connectStaff(token: string): Promise<Socket> {
  const socket: Socket = ioClient(`http://127.0.0.1:${(server.address() as { port: number }).port}/signova`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
  await once(socket, "connect");
  return socket;
}

/** Connect a Deaf-user socket and join a session room; wait for session:connected. */
async function connectDeafAndJoin(sessionId: string): Promise<Socket> {
  const socket: Socket = ioClient(`http://127.0.0.1:${(server.address() as { port: number }).port}/signova`, {
    auth: { token: deviceToken },
    transports: ["websocket"],
    reconnection: false,
  });
  await once(socket, "connect");
  await new Promise<void>((resolve, reject) => {
    let done = false;
    const onConnected = () => {
      if (done) return;
      done = true;
      resolve();
    };
    socket.on(S2C_MOBILE.SESSION_CONNECTED, onConnected);
    socket.emit(C2S.SESSION_JOIN, { sessionId });
    socket.on("connect_error", reject);
    setTimeout(() => {
      if (!done) reject(new Error("session:connected timed out"));
    }, 10000);
  });
  return socket;
}


test("socket: staff accepts via session:accept -> both parties notified, teller BUSY", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerA._id.toString(), method: "sign" }),
  });
  check("session created", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  let staffActive: any = null;
  let deafActive: any = null;
  const staffSocket = await connectStaff(graceToken);
  staffSocket.on(S2C_STAFF.SESSION_ACTIVE, (p) => {
    staffActive = p;
  });

  const deafSocket = await connectDeafAndJoin(sessionId);
  deafSocket.on(S2C_MOBILE.SESSION_ACTIVE, (p) => {
    deafActive = p;
  });

  await new Promise<void>((resolve) => {
    staffSocket.emit(C2S.SESSION_ACCEPT, { sessionId }, (ack: any) => resolve());
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 500));

  check("staff socket received session:active", !!staffActive, JSON.stringify(staffActive));
  check("deaf socket received session:active", !!deafActive, JSON.stringify(deafActive));

  const { Session, Teller } = await models();
  const session = await Session.findById(sessionId);
  check("session is ACTIVE", session?.status === "ACTIVE", `got ${session?.status}`);
  const teller = await Teller.findById(tellerA._id);
  check("teller is BUSY after socket accept", teller?.status === "BUSY", `got ${teller?.status}`);

  // Clean up: end the active session so tellerA is FREE for later tests.
  await j(`/api/sessions/${sessionId}/status`, {
    ...authHeader(deviceToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });

  staffSocket.close();
  deafSocket.close();
});

test("socket: Deaf user cannot accept a session request", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerB._id.toString(), method: "text" }),
  });
  check("session created", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  const deafSocket = await connectDeafAndJoin(sessionId);
  await new Promise<void>((resolve, reject) => {
    deafSocket.emit(C2S.SESSION_ACCEPT, { sessionId }, (ack: any) => {
      if (ack?.error) resolve();
      else reject(new Error("expected error ack, got " + JSON.stringify(ack)));
    });
    setTimeout(() => reject(new Error("no ack for Deaf accept attempt")), 10000);
  });
  deafSocket.close();

  const { Session } = await models();
  const session = await Session.findById(sessionId);
  check("session still CONNECTING (Deaf cannot accept)", session?.status === "CONNECTING", `got ${session?.status}`);

  // Clean up: brian (assigned to tellerB) rejects the lingering request so
  // the teller is not left RESERVED for later tests.
  await j(`/api/sessions/${sessionId}/reject`, { ...authHeader(brianToken), method: "POST" });
});

test("socket: unrelated staff cannot accept another teller's request", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerA._id.toString(), method: "sign" }),
  });
  check("session created", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  const brianSocket = await connectStaff(brianToken); // brian assigned to tellerB, not tellerA
  await new Promise<void>((resolve, reject) => {
    brianSocket.emit(C2S.SESSION_ACCEPT, { sessionId }, (ack: any) => {
      if (ack?.error) resolve();
      else reject(new Error("expected error ack, got " + JSON.stringify(ack)));
    });
    setTimeout(() => reject(new Error("no ack for unrelated accept attempt")), 10000);
  });
  brianSocket.close();

  const { Session } = await models();
  const session = await Session.findById(sessionId);
  check("session still CONNECTING (unrelated staff blocked)", session?.status === "CONNECTING", `got ${session?.status}`);
  const { Teller } = await models();
  const teller = await Teller.findById(tellerA._id);
  check("teller still RESERVED", teller?.status === "RESERVED", `got ${teller?.status}`);

  // Clean up: grace accepts then device ends.
  await j(`/api/sessions/${sessionId}/accept`, { ...authHeader(graceToken), method: "POST" });
  await j(`/api/sessions/${sessionId}/status`, {
    ...authHeader(deviceToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });
});

test("socket: staff rejects via session:reject -> Deaf notified, teller FREE", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerC._id.toString(), method: "sign" }),
  });
  check("session created for tellerC", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  let deafRejected: any = null;
  const deafSocket = await connectDeafAndJoin(sessionId);
  deafSocket.on(S2C_MOBILE.SESSION_REJECTED, (p) => {
    deafRejected = p;
  });

  const staffSocket = await connectStaff(njeriToken); // njeri assigned to tellerC
  await new Promise<void>((resolve) => {
    staffSocket.emit(C2S.SESSION_REJECT, { sessionId }, (ack: any) => resolve());
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 150));

  check("deaf socket received session:rejected", !!deafRejected, JSON.stringify(deafRejected));
  check("rejected carries sessionId", deafRejected?.sessionId === sessionId, JSON.stringify(deafRejected));
  check("rejected status is CANCELLED", deafRejected?.status === "CANCELLED", JSON.stringify(deafRejected));

  const { Session, Teller } = await models();
  const session = await Session.findById(sessionId);
  check("session is CANCELLED", session?.status === "CANCELLED", `got ${session?.status}`);
  const teller = await Teller.findById(tellerC._id);
  check("teller is FREE after socket reject", teller?.status === "FREE", `got ${teller?.status}`);

  staffSocket.close();
  deafSocket.close();
});

test("socket: duplicate accept via socket is idempotent", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerB._id.toString(), method: "text" }),
  });
  check("session created", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  const staffSocket = await connectStaff(brianToken);
  await new Promise<void>((resolve) => {
    staffSocket.emit(C2S.SESSION_ACCEPT, { sessionId }, () => resolve());
  });
  await new Promise<void>((resolve) => {
    staffSocket.emit(C2S.SESSION_ACCEPT, { sessionId }, () => resolve()); // second accept
  });
  await new Promise<void>((resolve) => setTimeout(resolve, 150));

  const { Session, Teller } = await models();
  const session = await Session.findById(sessionId);
  check("session still ACTIVE after duplicate accept", session?.status === "ACTIVE", `got ${session?.status}`);
  const teller = await Teller.findById(tellerB._id);
  check("teller still BUSY", teller?.status === "BUSY", `got ${teller?.status}`);

  // Clean up: device ends.
  await j(`/api/sessions/${sessionId}/status`, {
    ...authHeader(deviceToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });
  staffSocket.close();
});

// ------------------------------------------------------------------
// 22-24. Reconnection / missed-request recovery (authoritative state from backend)
// ------------------------------------------------------------------

test("reconnection: Deaf user fetches pending session via GET /api/sessions/current", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerA._id.toString(), method: "sign" }),
  });
  check("session created", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  // Simulate reconnect: fetch authoritative current session.
  const current = await j("/api/sessions/current", authHeader(deviceToken));
  check("current endpoint returns pending session (200)", current.status === 200, JSON.stringify(current));
  check("current session is CONNECTING", current.body.session?.status === "CONNECTING", JSON.stringify(current.body));
  check("current session id matches", current.body.session?._id === sessionId, JSON.stringify(current.body));

  // Clean up: grace accepts then device ends.
  await j(`/api/sessions/${sessionId}/accept`, { ...authHeader(graceToken), method: "POST" });
  await j(`/api/sessions/${sessionId}/status`, {
    ...authHeader(deviceToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });
});

test("reconnection: staff lists pending request via GET /api/sessions?tellerId&status=CONNECTING", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerB._id.toString(), method: "sign" }),
  });
  check("session created for tellerB", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  const list = await j(
    `/api/sessions?tellerId=${tellerB._id}&status=CONNECTING`,
    authHeader(brianToken),
  );
  check("staff pending list returns 200", list.status === 200, JSON.stringify(list));
  check(
    "pending request appears in list",
    Array.isArray(list.body?.sessions) && list.body.sessions.some((s: any) => s._id === sessionId),
    JSON.stringify(list),
  );

  // Clean up: brian rejects.
  await j(`/api/sessions/${sessionId}/reject`, { ...authHeader(brianToken), method: "POST" });
});


// ------------------------------------------------------------------
// 1. Creating a pending session marks teller RESERVED, not BUSY
// ------------------------------------------------------------------

test("create: pending session (CONNECTING) reserves teller as RESERVED, not BUSY", async () => {
  const res = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerA._id.toString(), method: "sign" }),
  });
  check("session created (201)", res.status === 201, JSON.stringify(res.body));
  check("session status is CONNECTING", res.body.session?.status === "CONNECTING", JSON.stringify(res.body));

  const { Teller } = await models();
  const teller = await Teller.findById(tellerA._id);
  check("teller is RESERVED after request creation", teller?.status === "RESERVED", `got ${teller?.status}`);
  check("teller is NOT BUSY after request creation", teller?.status !== "BUSY", `got ${teller?.status}`);

  // Recovery: the Deaf user can fetch their pending session.
  const current = await j("/api/sessions/current", authHeader(deviceToken));
  check(
    "current session endpoint returns the pending session",
    current.status === 200 && current.body.session?.status === "CONNECTING",
    JSON.stringify(current.body),
  );
});

// ------------------------------------------------------------------
// 2. Prevent two requests reserving the same teller
// ------------------------------------------------------------------

test("create: second request on a RESERVED teller is rejected (409)", async () => {
  const res = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerA._id.toString(), method: "text" }),
  });
  check("second request on reserved teller returns 409", res.status === 409, `got ${res.status}`);
  check("error code is CONFLICT", res.body.error?.code === "CONFLICT", JSON.stringify(res.body));

  const { Teller } = await models();
  const teller = await Teller.findById(tellerA._id);
  check("teller still RESERVED (not double-reserved)", teller?.status === "RESERVED", `got ${teller?.status}`);
  const { Session } = await models();
  const pending = await Session.countDocuments({
    organization: orgA._id,
    teller: tellerA._id,
    status: "CONNECTING",
  });
  check("exactly one pending session for the teller", pending === 1, `got ${pending}`);
});

// ------------------------------------------------------------------
// 3-6. Accept flow + authorization + idempotency
// ------------------------------------------------------------------

test("accept: unrelated staff (not assigned to teller) cannot accept (403)", async () => {
  const { Session } = await models();
  const pending = await Session.findOne({
    organization: orgA._id,
    teller: tellerA._id,
    status: "CONNECTING",
  })!;
  const res = await j(`/api/sessions/${pending._id.toString()}/accept`, {
    ...authHeader(brianToken), // brian is assigned to tellerB, not tellerA
    method: "POST",
  });
  check("unrelated staff acceptance denied (403)", res.status === 403, `got ${res.status} ${JSON.stringify(res.body)}`);
  const after = await Session.findById(pending._id);
  check("session still CONNECTING after blocked accept", after?.status === "CONNECTING", `got ${after?.status}`);
});

test("accept: Deaf user cannot accept a session request (403)", async () => {
  const { Session } = await models();
  const pending = await Session.findOne({
    organization: orgA._id,
    teller: tellerA._id,
    status: "CONNECTING",
  })!;
  const res = await j(`/api/sessions/${pending._id.toString()}/accept`, {
    ...authHeader(deviceToken),
    method: "POST",
  });
  check("Deaf user acceptance denied (403)", res.status === 403, `got ${res.status} ${JSON.stringify(res.body)}`);
});

test("accept: assigned staff accepts -> ACTIVE, teller BUSY", async () => {
  const { Session } = await models();
  const pending = await Session.findOne({
    organization: orgA._id,
    teller: tellerA._id,
    status: "CONNECTING",
  })!;
  const res = await j(`/api/sessions/${pending._id.toString()}/accept`, {
    ...authHeader(graceToken),
    method: "POST",
  });
  check("accept returns 200", res.status === 200, JSON.stringify(res.body));
  check("session is ACTIVE", res.body.session?.status === "ACTIVE", JSON.stringify(res.body));

  const { Teller } = await models();
  const teller = await Teller.findById(tellerA._id);
  check("teller is BUSY after accept", teller?.status === "BUSY", `got ${teller?.status}`);
});

test("accept: duplicate accept is idempotent (200, stays ACTIVE)", async () => {
  const { Session } = await models();
  const active = await Session.findOne({
    organization: orgA._id,
    teller: tellerA._id,
    status: "ACTIVE",
  })!;
  const res = await j(`/api/sessions/${active._id.toString()}/accept`, {
    ...authHeader(graceToken),
    method: "POST",
  });
  check("repeat accept returns 200", res.status === 200, `got ${res.status}`);
  check("session still ACTIVE", res.body.session?.status === "ACTIVE", JSON.stringify(res.body));
});

test("accept: cannot accept an already-ended session (conflict)", async () => {
  const { Session, Teller } = await models();
  const active = await Session.findOne({
    organization: orgA._id,
    teller: tellerA._id,
    status: "ACTIVE",
  })!;
  await j(`/api/sessions/${active._id.toString()}/status`, {
    ...authHeader(deviceToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });
  const res = await j(`/api/sessions/${active._id.toString()}/accept`, {
    ...authHeader(graceToken),
    method: "POST",
  });
  check("accept after end is conflict (409)", res.status === 409, `got ${res.status}`);
  const teller = await Teller.findById(tellerA._id);
  check("teller is FREE after session end", teller?.status === "FREE", `got ${teller?.status}`);
});

// ------------------------------------------------------------------
// 7-11. Reject flow + idempotency
// ------------------------------------------------------------------

test("reject: assigned staff rejects -> CANCELLED, teller FREE", async () => {
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerB._id.toString(), method: "sign" }),
  });
  check("request created for tellerB (201)", create.status === 201, JSON.stringify(create));

  const res = await j(`/api/sessions/${create.body.session._id}/reject`, {
    ...authHeader(brianToken),
    method: "POST",
  });
  check("reject returns 200", res.status === 200, JSON.stringify(res.body));
  check("session is CANCELLED", res.body.session?.status === "CANCELLED", JSON.stringify(res.body));

  const { Teller } = await models();
  const teller = await Teller.findById(tellerB._id);
  check("teller is FREE after reject", teller?.status === "FREE", `got ${teller?.status}`);
});

test("reject: duplicate reject is idempotent (200, stays CANCELLED)", async () => {
  const { Session } = await models();
  const cancelled = await Session.findOne({
    organization: orgA._id,
    teller: tellerB._id,
    status: "CANCELLED",
  })!;
  const res = await j(`/api/sessions/${cancelled._id.toString()}/reject`, {
    ...authHeader(brianToken),
    method: "POST",
  });
  check("repeat reject returns 200", res.status === 200, `got ${res.status}`);
  check("session still CANCELLED", res.body.session?.status === "CANCELLED", JSON.stringify(res.body));
});

test("reject: cannot reject an active session (conflict)", async () => {
  const { Session } = await models();
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerC._id.toString(), method: "text" }),
  });
  check("request created for tellerC", create.status === 201, JSON.stringify(create));

  const accept = await j(`/api/sessions/${create.body.session._id}/accept`, {
    ...authHeader(njeriToken), // njeri is assigned to tellerC
    method: "POST",
  });
  check("njeri accepts tellerC's request (200)", accept.status === 200, `got ${accept.status}`);

  const res = await j(`/api/sessions/${create.body.session._id}/reject`, {
    ...authHeader(njeriToken),
    method: "POST",
  });
  check("reject after accept is conflict (409)", res.status === 409, `got ${res.status}`);

  // Clean up: end the active session so tellerC is FREE for later tests.
  await j(`/api/sessions/${create.body.session._id}/status`, {
    ...authHeader(deviceToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });
});

test("reject: unrelated staff cannot reject another teller's request (403)", async () => {
  const { Session, Teller } = await models();
  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerC._id.toString(), method: "sign" }),
  });
  check("request created for tellerC", create.status === 201, JSON.stringify(create));

  const res = await j(`/api/sessions/${create.body.session._id}/reject`, {
    ...authHeader(brianToken), // brian is not assigned to tellerC
    method: "POST",
  });
  check("unrelated staff rejection denied (403)", res.status === 403, `got ${res.status} ${JSON.stringify(res.body)}`);
  const after = await Session.findById(create.body.session._id);
  check("session still CONNECTING after blocked reject", after?.status === "CONNECTING", `got ${after?.status}`);
  const teller = await Teller.findById(tellerC._id);
  check("teller still RESERVED", teller?.status === "RESERVED", `got ${teller?.status}`);

  // Njeri (assigned) rejects to clean up.
  await j(`/api/sessions/${create.body.session._id}/reject`, {
    ...authHeader(njeriToken),
    method: "POST",
  });
});

// ------------------------------------------------------------------
// 12. Reservation release: stuck RESERVED teller is reconciled to FREE
// ------------------------------------------------------------------

test("release: reconcileStuckTellers frees a RESERVED teller with no live session", async () => {
  const { Teller } = await models();
  const stuck = await Teller.create({
    organization: orgA._id,
    name: "Stuck Counter",
    serviceLabel: "KSL",
    serviceDesk: "Desk 99",
    counterNumber: "99",
    pairingCode: "STUCK",
    status: "RESERVED",
  });
  await (await import("../src/services/sessionService.js")).reconcileStuckTellers();
  const freed = await Teller.findById(stuck._id);
  check("stuck RESERVED teller freed to FREE", freed?.status === "FREE", `got ${freed?.status}`);
});

// ------------------------------------------------------------------
// 13. Socket.IO: staff socket receives session:request on creation
// ------------------------------------------------------------------

test("socket: assigned staff socket receives session:request when a Deaf user creates a pending session", async () => {
  let payload: any = null;
  const socket: Socket = ioClient(`http://127.0.0.1:${(server.address() as { port: number }).port}/signova`, {
    auth: { token: graceToken },
    transports: ["websocket"],
    reconnection: false,
  });
  await once(socket, "connect");
  socket.on(S2C_STAFF.SESSION_REQUEST, (p) => {
    payload = p;
  });

  const create = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: tellerA._id.toString(), method: "sign" }),
  });
  check("session created for socket test", create.status === 201, JSON.stringify(create));
  const sessionId = create.body.session._id;

  await new Promise<void>((resolve) => setTimeout(resolve, 200));
  socket.close();

  check("staff socket received session:request", !!payload, JSON.stringify(payload));
  check("request carries sessionId", payload?.sessionId === sessionId, JSON.stringify(payload));
  check("request carries tellerId", payload?.tellerId === tellerA._id.toString(), JSON.stringify(payload));
  check("request carries method", payload?.method === "sign", JSON.stringify(payload));

  // Clean up: reject the pending request so tellerA is FREE for later tests.
  await j(`/api/sessions/${sessionId}/reject`, { ...authHeader(graceToken), method: "POST" });
});
