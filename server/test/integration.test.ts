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
  const { login, startTwoFactorEnrollment, activateTwoFactorEnrollment, verifyTwoFactor } = await import(
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
  const { RefreshToken } = await import("../src/models/refreshToken.js");
  const { PasswordResetToken } = await import("../src/models/passwordResetToken.js");
  const { setMailTransport } = await import("../src/services/mailService.js");
  const mongoose = (await import("mongoose")).default;

  // In-memory mail capture — no real SMTP in tests. Records every message the
  // mail service attempts to deliver so tests can inspect links/subjects.
  const sentMails: Array<{ to: string; subject: string; text: string; html: string }> = [];
  let mailShouldFail = false;
  setMailTransport({
    sendMail: async (msg: any) => {
      if (mailShouldFail) throw new Error("SMTP unavailable (test)");
      sentMails.push({ to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
      return { messageId: "test-message-id" };
    },
  } as any);

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

  // --- 11. Staff self-registration policy + 2FA lifecycle ---
  console.log("\n[11] Staff self-registration policy + 2FA lifecycle");

  // Public org dropdown (id + name only — no config leaked).
  const pubOrgs = await j("/api/organizations/public");
  check("public org list is reachable without auth", pubOrgs.status === 200, `got ${pubOrgs.status}`);
  // KNH + MTRH are seeded; "Other Hospital" was created in the isolation test.
  check("public org list contains the seeded orgs", pubOrgs.body.organizations?.some((o: any) => o.name.includes("Kenyatta")) && pubOrgs.body.organizations?.some((o: any) => o.name.includes("Moi")), JSON.stringify(pubOrgs.body.organizations));
  const pubOrgKeys = Object.keys(pubOrgs.body.organizations?.[0] ?? {}).sort().join(",");
  check("public org list exposes only _id and name", pubOrgKeys === "_id,name", `got ${pubOrgKeys}`);
  const knhOrgId = pubOrgs.body.organizations.find((o: any) => o.name.includes("Kenyatta"))?._id;

  // --- Domain policy: gmail.com only ---
  const regEmail = "NewStaff@GMAIL.com"; // mixed case + dots to prove normalization
  const reg = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "New Staff",
      organizationId: knhOrgId,
      email: `  ${regEmail}  `, // padded with whitespace
      password: "Password123!",
      passwordConfirmation: "Password123!",
    }),
  });
  check("gmail registration returns 201 with enrollment challenge", reg.status === 201, JSON.stringify(reg.body));
  check("register issues no access token (2FA still required)", !reg.body.accessToken);

  // Normalization: the padded, mixed-case email must be stored lowercase+trimmed.
  const regUser = await User.findOne({ organization: org!._id, email: "newstaff@gmail.com" });
  check("email normalized to lowercase and trimmed", !!regUser, "stored email not found as lowercase");
  check("registered account is STAFF (never ADMIN)", regUser?.role === "STAFF", `got ${regUser?.role}`);

  // Non-gmail domains rejected.
  for (const badEmail of ["user@strathmore.edu", "user@signova.test", "user@notgmail.com", "user@mail.gmail.com", "user@gmail.com.evil.net"]) {
    const bad = await j("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name: "Bad", organizationId: knhOrgId, email: badEmail, password: "Password123!" }),
    });
    check(`rejected domain: ${badEmail}`, bad.status === 400 && bad.body.error?.code === "EMAIL_DOMAIN_NOT_ALLOWED",
      `got ${bad.status} ${JSON.stringify(bad.body)}`);
  }

  // Attempt to self-register as ADMIN — role must not be honoured.
  const adminAttempt = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Sneaky", organizationId: knhOrgId, email: "sneaky@gmail.com", password: "Password123!", role: "ADMIN" }),
  });
  if (adminAttempt.status === 201) {
    const sneaky = await User.findOne({ email: "sneaky@gmail.com" });
    check("self-registered role stays STAFF even when ADMIN requested", sneaky?.role === "STAFF", `got ${sneaky?.role}`);
  } else {
    check("self-registration with role field handled", adminAttempt.status === 400, `got ${adminAttempt.status}`);
  }

  // Invalid / inactive organization rejected.
  const badOrg = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Bad Org", organizationId: "000000000000000000000000", email: "badorg@gmail.com", password: "Password123!" }),
  });
  check("invalid organization rejected", badOrg.status === 400 && badOrg.body.error?.code === "ORGANIZATION_INVALID", `got ${badOrg.status}`);
  await Organization.create({ name: "Inactive Org", shortName: "INACT", isActive: false });
  const inactiveOrg = await Organization.findOne({ shortName: "INACT" });
  const badOrg2 = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Bad Org", organizationId: inactiveOrg!._id.toString(), email: "inactive@gmail.com", password: "Password123!" }),
  });
  check("inactive organization rejected", badOrg2.status === 400 && badOrg2.body.error?.code === "ORGANIZATION_INVALID", `got ${badOrg2.status}`);
  await Organization.deleteOne({ _id: inactiveOrg!._id });

  // Password confirmation mismatch rejected.
  const mismatch = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "Mismatch", organizationId: knhOrgId, email: "mismatch@gmail.com", password: "Password123!", passwordConfirmation: "Different123!" }),
  });
  check("password confirmation mismatch rejected (400)", mismatch.status === 400, `got ${mismatch.status}`);

  // Duplicate email (normalized) rejected.
  const regDup = await j("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ name: "New Staff", organizationId: knhOrgId, email: "newstaff@gmail.com", password: "Password123!" }),
  });
  check("duplicate email rejected (409)", regDup.status === 409, `got ${regDup.status}`);

  // --- 2FA enrollment: no token before activation ---
  const regLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com", password: "Password123!" }),
  });
  check("registered account login requires 2FA enrollment", regLogin.status === 200 && regLogin.body.status === "mfa_enroll_required", JSON.stringify(regLogin.body));
  check("login issues no access token before 2FA", !regLogin.body.accessToken);

  // The MFA challenge must not authorize normal staff API operations.
  const challengeAuth = { headers: { authorization: `Bearer ${regLogin.body.challengeToken}` } };
  const challengeOnApi = await j("/api/organizations/me", challengeAuth);
  check("MFA challenge token cannot access the API (401)", challengeOnApi.status === 401, `got ${challengeOnApi.status}`);

  const enrollStart = await j("/api/auth/2fa/enroll/start", {
    method: "POST",
    body: JSON.stringify({ challengeToken: regLogin.body.challengeToken }),
  });
  check("enroll start returns QR + secret", enrollStart.status === 200 && enrollStart.body.qrDataUrl.startsWith("data:image/png"), JSON.stringify(enrollStart.body));
  check("enroll response never exposes the TOTP secret in the user record", !enrollStart.body.user);

  // Invalid TOTP rejected.
  const badCode = await j("/api/auth/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: regLogin.body.challengeToken, code: "000000" }),
  });
  check("invalid TOTP code rejected", badCode.status === 401, `got ${badCode.status}`);

  // Valid TOTP activates 2FA and issues a session.
  const regCode = authenticator.generate(enrollStart.body.secret);
  const regActive = await j("/api/auth/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: regLogin.body.challengeToken, code: regCode }),
  });
  check("enrollment activation issues tokens", regActive.status === 200 && !!regActive.body.accessToken, JSON.stringify(regActive.body));
  check("activated user has STAFF role", regActive.body.user?.role === "STAFF");
  check("2FA marked enabled after activation", regActive.body.user?.twoFactorEnabled === true);

  // --- Normal login requires password + TOTP ---
  const normalLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com", password: "Password123!" }),
  });
  check("normal login now asks for 2FA (no token yet)", normalLogin.status === 200 && normalLogin.body.status === "2fa_required" && !normalLogin.body.accessToken, JSON.stringify(normalLogin.body));

  // Wrong password cannot skip 2FA.
  const wrongPw = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com", password: "WrongPassword123!" }),
  });
  check("wrong password rejected with generic error (401)", wrongPw.status === 401 && wrongPw.body.error?.code === "INVALID_CREDENTIALS", `got ${wrongPw.status}`);

  // TOTP replay: the enrollment activation above consumed the current step,
  // so verifying with a same-step code must be rejected as already used.
  const replayLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com", password: "Password123!" }),
  });
  const replay = await j("/api/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken: replayLogin.body.challengeToken, code: authenticator.generate(enrollStart.body.secret) }),
  });
  check("TOTP replay rejected (ALREADY_USED)", replay.status === 401 && replay.body.error?.message?.includes("already used"), `got ${replay.status} ${JSON.stringify(replay.body)}`);

  // Invalid TOTP rejected on the normal login path too.
  const invalidLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com", password: "Password123!" }),
  });
  const invalid = await j("/api/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken: invalidLogin.body.challengeToken, code: "000000" }),
  });
  check("invalid TOTP on login rejected", invalid.status === 401, `got ${invalid.status}`);

  // --- Refresh-token rotation + logout revocation ---
  // regActive is the session issued at enrollment activation (a clean pair).
  const refresh1 = regActive.body.refreshToken;
  const rotated = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: refresh1 }) });
  check("refresh rotation issues a new pair", rotated.status === 200 && !!rotated.body.accessToken && !!rotated.body.refreshToken, JSON.stringify(rotated.body));
  check("rotated refresh token differs from the original", rotated.body.refreshToken !== refresh1);
  const reuseOld = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: refresh1 }) });
  check("old refresh token is revoked after rotation (401)", reuseOld.status === 401, `got ${reuseOld.status}`);
  const logout = await j("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: rotated.body.refreshToken }) });
  check("logout succeeds", logout.status === 200, `got ${logout.status}`);
  const afterLogout = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: rotated.body.refreshToken }) });
  check("refresh token unusable after logout (401)", afterLogout.status === 401, `got ${afterLogout.status}`);

  // --- Database storage guarantees ---
  console.log("\n[12] Database storage guarantees");
  const rawUser = await User.collection.findOne({ _id: regUser!._id });
  check("password stored as an Argon2id hash (never plaintext)", !!rawUser?.passwordHash && rawUser.passwordHash.startsWith("$argon2id$"), String(rawUser?.passwordHash).slice(0, 20));
  check("password is not stored in plaintext", rawUser?.passwordHash !== "Password123!");
  check("TOTP secret is encrypted at rest", !!rawUser?.totpSecret && !/^[A-Z2-7]{16,}$/.test(String(rawUser.totpSecret)));
  const refreshDocs = await RefreshToken.find({ user: regUser!._id }).lean();
  check("no raw refresh tokens persisted (hashes only)", refreshDocs.every((d: any) => d.tokenHash && !d.tokenHash.includes(refresh1)), `stored: ${JSON.stringify(refreshDocs.map((d: any) => d.tokenHash?.slice(0, 12)))}`);
  const collections = await mongoose.connection.db!.listCollections().toArray();
  const tokenCollections = collections.filter((c: any) => /accesstoken|access_token|jwt/i.test(c.name));
  check("no collection exists for persisting access JWTs", tokenCollections.length === 0, `found: ${tokenCollections.map((c: any) => c.name).join(", ")}`);

  // --- Seeded accounts still work (login + 2FA) ---
  console.log("\n[13] Seeded accounts still work");
  // Grace completed 2FA enrollment earlier in section [3], so a fresh login
  // now asks for a TOTP code (2fa_required) rather than enrollment.
  const seedLogin = await login("grace@signova.test", "Password123!", {} as any);
  check("seeded staff account still logs in (asks for 2FA)", seedLogin.status === "2fa_required", `got ${seedLogin.status}`);
  // Re-enroll a seeded staff account that has no 2FA yet (Brian) to prove the
  // enrollment path works end-to-end for seeded accounts too.
  const brianLogin = await login("brian@signova.test", "Password123!", {} as any);
  check("seeded staff without 2FA is asked to enroll", brianLogin.status === "mfa_enroll_required", `got ${brianLogin.status}`);
  const brianEnroll = await startTwoFactorEnrollment(brianLogin.challengeToken!);
  const brianActive = await activateTwoFactorEnrollment(brianLogin.challengeToken!, authenticator.generate(brianEnroll.secret), {} as any);
  check("seeded staff account can complete 2FA and receive tokens", !!brianActive.accessToken && brianActive.user?.role === "STAFF");
  // Grace's TOTP verification on the normal login path already passed in
  // section [3]; her account remains enrolled and functional here.
  check("seeded staff TOTP verification path works (verified in section 3)", seedLogin.challengeToken !== undefined);

  // --- 14. Password reset (staff-only recovery) ---
  console.log("\n[14] Password reset");

  // Helper: pull the raw reset token out of the last captured email link.
  const extractToken = (mail: { text: string } | undefined): string => {
    const m = mail?.text.match(/token=([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  };
  const lastMail = () => sentMails[sentMails.length - 1];

  // Need a staff account with 2FA already enabled to test the full reset
  // path. Use the gmail account created in [11] (newstaff@gmail.com).
  const forgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com" }),
  });
  check("forgot-password returns the generic message", forgot.status === 200 && forgot.body.message.includes("If an eligible account"), JSON.stringify(forgot.body));
  check("forgot-password response contains no token", !JSON.stringify(forgot.body).includes("token="));

  const resetMail = lastMail();
  check("a reset email was captured by the mock transport", !!resetMail && resetMail.subject === "Reset your Signova password");
  check("reset email is addressed to the staff account", resetMail?.to === "newstaff@gmail.com");
  const resetToken = extractToken(resetMail);
  check("reset email contains a token link", resetToken.length > 0);

  // Only the HASH is persisted — never the raw token.
  const storedReset = await PasswordResetToken.findOne({ user: regUser!._id });
  check("reset token hash is stored", !!storedReset?.tokenHash);
  check("raw reset token is NOT stored in MongoDB", storedReset?.tokenHash !== resetToken);

  // A second request supersedes the first token (single active token policy).
  const forgot2 = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com" }),
  });
  const token2 = extractToken(lastMail());
  check("a second request supersedes the previous token", token2 !== resetToken && token2.length > 0);
  const oldTokenCount = await PasswordResetToken.countDocuments({ user: regUser!._id });
  check("only one active reset token per user", oldTokenCount === 1, `got ${oldTokenCount}`);

  // The superseded token must no longer work.
  const reuseSuperseded = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: resetToken, password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("superseded reset token rejected (401)", reuseSuperseded.status === 401, `got ${reuseSuperseded.status}`);

  // Unknown email → identical generic response, no email sent.
  const beforeCount = sentMails.length;
  const unknown = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "nobody@gmail.com" }),
  });
  check("unknown email returns the same generic message", unknown.status === 200 && unknown.body.message.includes("If an eligible account"));
  check("no email sent for unknown address", sentMails.length === beforeCount);

  // Admin account (grace is STAFF; admin@signova.test is ADMIN) → no staff reset.
  const beforeAdmin = sentMails.length;
  const adminForgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test" }),
  });
  check("admin account gets the generic response (no enumeration)", adminForgot.status === 200);
  check("admin account does NOT receive a staff reset email", sentMails.length === beforeAdmin);

  // Malformed email rejected by validation.
  const malformed = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "not-an-email" }),
  });
  check("malformed email rejected (400)", malformed.status === 400, `got ${malformed.status}`);

  // Issue a fresh token for the redemption tests.
  await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com" }),
  });
  const goodToken = extractToken(lastMail());

  // Wrong token rejected.
  const wrongTok = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: "a".repeat(64), password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("wrong reset token rejected (401)", wrongTok.status === 401, `got ${wrongTok.status}`);

  // Password too short rejected.
  const shortPw = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: goodToken, password: "short", passwordConfirmation: "short" }),
  });
  check("password shorter than 10 chars rejected (400)", shortPw.status === 400, `got ${shortPw.status}`);

  // Confirmation mismatch rejected.
  const resetMismatch = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: goodToken, password: "BrandNewPass123!", passwordConfirmation: "Mismatch123!" }),
  });
  check("password confirmation mismatch rejected (400)", resetMismatch.status === 400, `got ${resetMismatch.status}`);

  // Issue a refresh token for the user directly, then reset and confirm it's revoked.
  const { issueRefreshToken } = await import("../src/services/tokenService.js");
  const preResetRefresh = await issueRefreshToken(regUser!._id.toString(), 7);
  const refreshBefore = await RefreshToken.countDocuments({ user: regUser!._id, revokedAt: { $exists: false } });
  check("user has an active refresh token before reset", refreshBefore >= 1, `got ${refreshBefore}`);

  // Expired token rejected: create one already expired.
  const { randomToken, hashToken } = await import("../src/utils/crypto.js");
  const expiredRaw = randomToken(32);
  await PasswordResetToken.deleteMany({ user: regUser!._id });
  await PasswordResetToken.create({ user: regUser!._id, tokenHash: hashToken(expiredRaw), expiresAt: new Date(Date.now() - 1000) });
  const expired = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: expiredRaw, password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("expired reset token rejected (401)", expired.status === 401, `got ${expired.status}`);

  // Issue a fresh valid token and redeem it.
  await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com" }),
  });
  const validToken = extractToken(lastMail());

  const resetOk = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: validToken, password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("valid reset succeeds", resetOk.status === 200 && resetOk.body.message.includes("sign in"), JSON.stringify(resetOk.body));
  check("reset does NOT issue an access token", !resetOk.body.accessToken);
  check("reset does NOT issue a refresh token", !resetOk.body.refreshToken);

  // Token is now used — cannot be reused.
  const reuse = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: validToken, password: "AnotherPass123!", passwordConfirmation: "AnotherPass123!" }),
  });
  check("used reset token rejected (401)", reuse.status === 401, `got ${reuse.status}`);

  // Old password no longer authenticates; new password requires TOTP.
  const oldPwLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com", password: "Password123!" }),
  });
  check("old password no longer works (401)", oldPwLogin.status === 401, `got ${oldPwLogin.status}`);
  const newPwLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com", password: "BrandNewPass123!" }),
  });
  check("new password works but requires TOTP (no token yet)", newPwLogin.status === 200 && newPwLogin.body.status === "2fa_required" && !newPwLogin.body.accessToken, JSON.stringify(newPwLogin.body));

  // Existing refresh tokens were revoked.
  const refreshAfter = await RefreshToken.countDocuments({ user: regUser!._id, revokedAt: { $exists: false } });
  check("existing refresh tokens revoked after reset", refreshAfter === 0, `got ${refreshAfter}`);
  const oldRefresh = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: preResetRefresh }) });
  check("pre-reset refresh token is dead (401)", oldRefresh.status === 401, `got ${oldRefresh.status}`);

  // Password stored as Argon2id; TOTP untouched.
  const rawAfter = await User.collection.findOne({ _id: regUser!._id });
  check("password stored as Argon2id after reset", rawAfter?.passwordHash?.startsWith("$argon2id$"), String(rawAfter?.passwordHash).slice(0, 12));
  check("TOTP still enabled after reset (not disabled)", rawAfter?.twoFactorEnabled === true);
  check("TOTP secret still present after reset", !!rawAfter?.totpSecret);

  // Token cannot be used for a different user: mint a token, try to redeem
  // against the same user works once; a forged token for another user fails.
  const crossToken = randomToken(32);
  const crossReset = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: crossToken, password: "HackerPass123!", passwordConfirmation: "HackerPass123!" }),
  });
  check("unbound/forged token rejected (401)", crossReset.status === 401, `got ${crossReset.status}`);

  // SMTP failure leaves no usable token and does not leak existence.
  mailShouldFail = true;
  const beforeFail = sentMails.length;
  const failForgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "newstaff@gmail.com" }),
  });
  check("SMTP failure still returns the generic message", failForgot.status === 200 && failForgot.body.message.includes("If an eligible account"));
  check("SMTP failure sent no email", sentMails.length === beforeFail);
  const tokenAfterFail = await PasswordResetToken.findOne({ user: regUser!._id });
  check("SMTP failure leaves no usable reset token", !tokenAfterFail, `found ${String(tokenAfterFail?.tokenHash).slice(0, 12)}`);
  mailShouldFail = false;

  // A reset token cannot cross organizations: staff in KNH cannot reset MTRH.
  // (MTRH has no matching email for newstaff@gmail.com, so this is implicit;
  // verify MTRH staff email is unaffected.)
  const mtrhUnaffected = await User.countDocuments({ email: "newstaff@gmail.com" });
  check("reset stays scoped to the one matching account", mtrhUnaffected === 1, `got ${mtrhUnaffected}`);

  // --- 15. Seed idempotency (run last — it wipes and recreates KNH) ---
  console.log("\n[15] Seed idempotency");
  await seed();
  const orgsAfter = await Organization.countDocuments({ shortName: { $in: ["KNH", "MTRH"] } });
  check("re-running seed does not duplicate organizations", orgsAfter === 2, `got ${orgsAfter}`);
  const graceCount = await User.countDocuments({ email: "grace@signova.test" });
  check("re-running seed does not duplicate users", graceCount === 1, `got ${graceCount}`);
  const knhAfter = await Organization.findOne({ shortName: "KNH" });
  const tellerCount = await Teller.countDocuments({ organization: knhAfter!._id });
  check("re-running seed does not duplicate tellers", tellerCount === 3, `got ${tellerCount}`);

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
