/**
 * End-to-end Phase 1 verification (MOCK translation, no ML).
 *
 * Boots the real Express app + Socket.IO against an in-memory MongoDB
 * (mongodb-memory-server) and exercises:
 *   1. Health check
 *   2. Seed (org, admin, staff, tellers)
 *   3. Auth: login → 2FA enroll → activate → token
 *   4. Org isolation: cross-org access is blocked
 *   5. RBAC: staff cannot hit admin endpoints
 *   6. Session create (mobile device) → teller marked BUSY
 *   7. Mock translation endpoint returns the Translation contract
 *   8. Message send + confirm flow
 *   9. Session end → teller freed, SessionLog finalized
 *  10. Socket.IO: authenticated staff socket receives session:request
 *
 * Run: node --import tsx test/integration.test.ts
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import { io as ioClient, type Socket } from "socket.io-client";

process.env.NODE_ENV = "test";
process.env.PORT = "4599";
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

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(`${name} ${detail}`);
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function main() {
  console.log("Starting in-memory MongoDB...");
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();

  // Import the server bootstrap pieces (env is now set).
  const { connectDatabase } = await import("../src/config/db.js");
  const { seed } = await import("../src/seed/seed.js");
  const { login, startTwoFactorEnrollment, activateTwoFactorEnrollment } = await import(
    "../src/services/authService.js"
  );
  const { authenticator } = await import("otplib");
  const express = (await import("express")).default;
  const { createServer } = await import("node:http");
  const { initRealtime } = await import("../src/realtime/gateway.js");
  const { createSession, updateSessionStatus } = await import("../src/services/sessionService.js");
  const { sendMessage } = await import("../src/services/messageService.js");
  const { translate } = await import("../src/services/translationService.js");
  const { Organization } = await import("../src/models/organization.js");
  const { User } = await import("../src/models/user.js");
  const { Teller } = await import("../src/models/teller.js");

  await connectDatabase();

  // Build the app (mirror src/index.ts wiring, minus process.exit on failure).
  const authRoutes = (await import("../src/routes/auth.js")).default;
  const orgRoutes = (await import("../src/routes/organizations.js")).default;
  const tellerRoutes = (await import("../src/routes/tellers.js")).default;
  const sessionRoutes = (await import("../src/routes/sessions.js")).default;
  const messageRoutes = (await import("../src/routes/messages.js")).default;
  const translationRoutes = (await import("../src/routes/translation.js")).default;
  const kioskRoutes = (await import("../src/routes/kiosk.js")).default;
  const staffRoutes = (await import("../src/routes/staff.js")).default;
  const healthRoutes = (await import("../src/routes/health.js")).default;
  const { errorHandler, notFoundHandler } = await import("../src/middleware/error.js");

  const app = express();
  app.use(express.json());
  app.use("/api/health", healthRoutes);
  app.use("/api/auth", authRoutes);
  app.use("/api/organizations", orgRoutes);
  app.use("/api/tellers", tellerRoutes);
  app.use("/api/sessions", sessionRoutes);
  app.use("/api/sessions", translationRoutes);
  app.use("/api/sessions/:id/messages", messageRoutes);
  app.use("/api/kiosk", kioskRoutes);
  app.use("/api/staff", staffRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = createServer(app);
  const io = initRealtime(server);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const j = async (path: string, opts: RequestInit = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...opts,
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
    });
    return { status: res.status, body: await res.json().catch(() => null) as any };
  };

  // --- 1. Health ---
  console.log("\n[1] Health check");
  const health = await j("/api/health");
  check("health returns 200", health.status === 200);
  check("health reports db connected", health.body?.db === "connected", JSON.stringify(health.body));

  // --- 2. Seed ---
  console.log("\n[2] Seed");
  await seed();
  const org = await Organization.findOne({ shortName: "KNH" });
  check("org created", !!org);
  const teller = await Teller.findOne({ organization: org!._id });
  check("tellers created", (await Teller.countDocuments({ organization: org!._id })) === 3);
  check("teller initially FREE", teller!.status === "FREE");

  // --- 3. Auth: full 2FA enroll + activate ---
  console.log("\n[3] Authentication + 2FA");
  const loginRes = await login("admin@signova.test", "Password123!", {} as any);
  check("login requires 2FA enrollment (no token yet)", loginRes.status === "mfa_enroll_required");
  check("no access token before 2FA", !loginRes.accessToken);
  const challenge = loginRes.challengeToken!;
  check("challenge token issued", !!challenge);

  const enroll = await startTwoFactorEnrollment(challenge);
  check("enroll returns secret + QR", !!enroll.secret && enroll.qrDataUrl.startsWith("data:image/png"));
  const code = authenticator.generate(enroll.secret);
  const activated = await activateTwoFactorEnrollment(challenge, code, {} as any);
  check("activation returns access + refresh token", !!activated.accessToken && !!activated.refreshToken);
  const adminToken = activated.accessToken!;

  // Wrong code rejected
  let rejected = false;
  try {
    await activateTwoFactorEnrollment(challenge, "000000", {} as any);
  } catch {
    rejected = true;
  }
  check("invalid OTP code rejected", rejected);

  // Protected route without token → 401
  const noAuth = await j("/api/organizations/me");
  check("protected route rejects missing token", noAuth.status === 401);

  // With token → 200
  const authed = { headers: { authorization: `Bearer ${adminToken}` } };
  const me = await j("/api/organizations/me", authed);
  check("authenticated org fetch works", me.status === 200 && me.body.organization.shortName === "KNH");

  // --- 4. RBAC: staff cannot hit admin endpoints ---
  console.log("\n[4] RBAC");
  const staffLogin = await login("grace@signova.test", "Password123!", {} as any);
  const staffEnroll = await startTwoFactorEnrollment(staffLogin.challengeToken!);
  const staffCode = authenticator.generate(staffEnroll.secret);
  const staffAct = await activateTwoFactorEnrollment(staffLogin.challengeToken!, staffCode, {} as any);
  const staffToken = staffAct.accessToken!;
  const staffAuth = { headers: { authorization: `Bearer ${staffToken}` } };

  const staffHitsAdmin = await j("/api/staff", staffAuth);
  check("staff blocked from admin endpoint (403)", staffHitsAdmin.status === 403, `got ${staffHitsAdmin.status}`);
  const adminHitsStaff = await j("/api/staff", authed);
  check("admin allowed on staff endpoint (200)", adminHitsStaff.status === 200);

  // --- 5. Org isolation ---
  console.log("\n[5] Organization isolation");
  const otherOrg = await Organization.create({
    name: "Other Hospital", shortName: "OTH", welcomeMessage: "", serviceName: "s", counterLabel: "c",
  });
  const otherUser = await User.create({
    organization: otherOrg._id, role: "ADMIN", name: "Other Admin",
    email: "other@signova.test", passwordHash: (await import("../src/services/tokenService.js")).hashPassword
      ? await (await import("../src/services/tokenService.js")).hashPassword("Password123!") : "",
  });
  // Forge a token for the other org's user via direct JWT signing.
  const { signAccessToken } = await import("../src/utils/jwt.js");
  const otherToken = signAccessToken({ sub: otherUser._id.toString(), orgId: otherOrg._id.toString(), role: "ADMIN" });
  const otherAuth = { headers: { authorization: `Bearer ${otherToken}` } };
  const crossOrgTeller = await j(`/api/tellers/${teller!._id.toString()}`, otherAuth);
  check("cross-org teller access blocked (404)", crossOrgTeller.status === 404, `got ${crossOrgTeller.status}`);
  const crossOrgSessions = await j("/api/sessions", otherAuth);
  check("cross-org session list empty", crossOrgSessions.status === 200 && crossOrgSessions.body.sessions.length === 0);

  // --- 6. Session create (device) + teller BUSY ---
  console.log("\n[6] Session lifecycle");
  const { signAccessToken: signAT } = await import("../src/utils/jwt.js");
  // Device token: role DEAF_USER for a synthetic device user in the KNH org.
  const deviceUser = await User.create({
    organization: org!._id, role: "DEAF_USER", name: "Test Device", phone: "device-xyz",
  });
  const deviceToken = signAT({ sub: deviceUser._id.toString(), orgId: org!._id.toString(), role: "DEAF_USER" });
  const deviceAuth = { headers: { authorization: `Bearer ${deviceToken}` } };

  // Attach a staff socket to capture session:request.
  let socketRequest: any = null;
  const staffSocket: Socket = ioClient(`http://127.0.0.1:${port}/signova`, {
    auth: { token: staffToken },
    transports: ["websocket"],
  });
  await new Promise<void>((resolve, reject) => {
    staffSocket.on("connect", () => resolve());
    staffSocket.on("connect_error", (e) => reject(e));
    setTimeout(() => reject(new Error("staff socket timeout")), 5000);
  });
  staffSocket.on("session:request", (p) => { socketRequest = p; });
  await new Promise((r) => setTimeout(r, 300));

  const sess = await j("/api/sessions", {
    ...deviceAuth,
    method: "POST",
    body: JSON.stringify({ tellerId: teller!._id.toString(), method: "sign" }),
  });
  check("session created (201)", sess.status === 201, JSON.stringify(sess.body));
  const sessionId = sess.body.session._id;
  check("session starts CONNECTING", sess.body.session.status === "CONNECTING");

  const tellerAfter = await Teller.findById(teller!._id);
  check("teller marked BUSY", tellerAfter!.status === "BUSY");

  await new Promise((r) => setTimeout(r, 300));
  check("staff socket received session:request", !!socketRequest && socketRequest.sessionId === sessionId,
    JSON.stringify(socketRequest));

  // --- 7. Mock translation ---
  console.log("\n[7] Mock translation contract");
  const tr = await j(`/api/sessions/${sessionId}/translate`, {
    ...deviceAuth, method: "POST", body: JSON.stringify({ input: "opaque-blob", durationMs: 3000 }),
  });
  check("translate returns 200", tr.status === 200, JSON.stringify(tr.body));
  check("translation has gloss", typeof tr.body.translation?.gloss === "string" && tr.body.translation.gloss.length > 0);
  check("translation has confidence 0..1", typeof tr.body.translation?.confidence === "number" && tr.body.translation.confidence >= 0 && tr.body.translation.confidence <= 1);
  check("translation has alternatives array", Array.isArray(tr.body.translation?.alternatives));
  check("latency recorded", typeof tr.body.latencyMs === "number");

  // --- 8. Message send + confirm ---
  console.log("\n[8] Message flow");
  const msg = await j(`/api/sessions/${sessionId}/messages`, {
    ...deviceAuth, method: "POST",
    body: JSON.stringify({ sender: "USER", text: tr.body.translation.gloss, method: "sign", confidence: tr.body.translation.confidence, isConfirmed: true }),
  });
  check("message sent (201)", msg.status === 201);
  check("message persisted with confidence + isConfirmed", msg.body.message.confidence !== undefined && msg.body.message.isConfirmed === true);

  const msgs = await j(`/api/sessions/${sessionId}/messages`, deviceAuth);
  check("messages retrievable", msgs.status === 200 && msgs.body.messages.length === 1);

  // Staff reply
  const reply = await j(`/api/sessions/${sessionId}/messages`, {
    ...staffAuth, method: "POST",
    body: JSON.stringify({ sender: "STAFF", text: "How can I help?", method: "speech" }),
  });
  check("staff reply sent", reply.status === 201);

  // --- 9. Session end ---
  console.log("\n[9] Session end + logs");
  const end = await j(`/api/sessions/${sessionId}/status`, {
    ...deviceAuth, method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });
  check("session ended", end.status === 200 && end.body.session.status === "ENDED");
  const tellerFreed = await Teller.findById(teller!._id);
  check("teller freed after end", tellerFreed!.status === "FREE");
  const { SessionLog } = await import("../src/models/sessionLog.js");
  const log = await SessionLog.findOne({ session: sessionId });
  check("session log finalized with events", !!log && log.events.length >= 3 && log.latencyMs.length >= 1);

  staffSocket.close();

  // --- 10. Public kiosk endpoints (mobile, unauthenticated) ---
  console.log("\n[10] Kiosk endpoints (public, unauthenticated)");
  const kOrg = await j("/api/kiosk/organization");
  check("public org config loads without auth", kOrg.status === 200 && kOrg.body.organization.shortName === "KNH", JSON.stringify(kOrg.body));

  const kTellers = await j("/api/kiosk/tellers");
  check("public teller list loads", kTellers.status === 200 && kTellers.body.tellers.length === 3);
  const freeTeller = kTellers.body.tellers.find((t: any) => t.status === "FREE");
  check("a FREE teller is available", !!freeTeller);

  const kSess = await j("/api/kiosk/sessions", {
    method: "POST",
    body: JSON.stringify({ tellerId: freeTeller._id, method: "sign", deviceId: "kiosk-device-abc" }),
  });
  check("kiosk session created (201)", kSess.status === 201, JSON.stringify(kSess.body));
  check("kiosk returns device access token", typeof kSess.body.accessToken === "string" && kSess.body.accessToken.length > 20);
  const kioskSessionId = kSess.body.session._id;

  // Device token can call a protected session endpoint.
  const kioskAuth = { headers: { authorization: `Bearer ${kSess.body.accessToken}` } };
  const kMsgs = await j(`/api/sessions/${kioskSessionId}/messages`, kioskAuth);
  check("device token can access its session messages", kMsgs.status === 200, `got ${kMsgs.status}`);

  // Busy teller must be rejected cleanly.
  const kSessBusy = await j("/api/kiosk/sessions", {
    method: "POST",
    body: JSON.stringify({ tellerId: freeTeller._id, method: "sign", deviceId: "kiosk-device-abc" }),
  });
  check("busy teller rejected (409)", kSessBusy.status === 409, `got ${kSessBusy.status} ${JSON.stringify(kSessBusy.body)}`);

  // End the kiosk session so state is clean.
  await j(`/api/sessions/${kioskSessionId}/status`, {
    ...kioskAuth, method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });

  // --- Summary ---
  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log(`========================================`);

  await mem.stop();
  io.close();
  server.close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
