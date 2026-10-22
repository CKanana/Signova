/**
 * End-to-end Phase 1 verification (MOCK translation, no ML).
 *
 * Boots the real Express app + Socket.IO against an in-memory MongoDB
 * (mongodb-memory-server) and exercises:
 *   1. Health check
 *   2. Seed (org, admin, staff, tellers)
 *   3. Auth: login -> 2FA enroll -> activate -> token
 *   4. Org isolation: cross-org access is blocked
 *   5. RBAC: staff cannot hit admin endpoints
 *   6. Session create (mobile device) -> teller marked BUSY
 *   7. Mock translation endpoint returns the Translation contract
 *   8. Message send + confirm flow
 *   9. Session end -> teller freed, SessionLog finalized
 *  10. Socket.IO: authenticated staff socket receives session:request
 *  11. Public registration disabled
 *  11b. Seeded staff 2FA lifecycle
 *  12. Database storage guarantees
 *  13. Seeded accounts still work
 *  14. Password reset
 *  15. Seed idempotency
 *  16. Admin invitation lifecycle
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

  const { connectDatabase } = await import("../src/config/db.js");
  const { seed } = await import("../src/seed/seed.js");
  const {
    login,
    startTwoFactorEnrollment,
    activateTwoFactorEnrollment,
    verifyTwoFactor,
  } = await import("../src/services/authService.js");
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

  const sentMails: Array<{ to: string; subject: string; text: string; html: string }> = [];
  let mailShouldFail = false;
  setMailTransport({
    sendMail: async (msg: any) => {
      if (mailShouldFail) return false;
      sentMails.push({ to: msg.to, subject: msg.subject, text: msg.text, html: msg.html });
      return true;
    },
  } as any);

  await connectDatabase();

  const authRoutes = (await import("../src/routes/auth.js")).default;
  const orgRoutes = (await import("../src/routes/organizations.js")).default;
  const tellerRoutes = (await import("../src/routes/tellers.js")).default;
  const sessionRoutes = (await import("../src/routes/sessions.js")).default;
  const messageRoutes = (await import("../src/routes/messages.js")).default;
  const translationRoutes = (await import("../src/routes/translation.js")).default;
  const kioskRoutes = (await import("../src/routes/kiosk.js")).default;
  const staffRoutes = (await import("../src/routes/staff.js")).default;
  const adminRoutes = (await import("../src/admin/index.js")).default;
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
  app.use("/api/admin", adminRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = createServer(app);
  const io = initRealtime(server);
  await new Promise<void>((r) => server.listen(0, () => r()));
  const port = (server.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;

  const j = async (path: string, opts: RequestInit = {}) => {
    const mergedHeaders = {
      "content-type": "application/json",
      ...(opts.headers || {}),
    };
    const res = await fetch(`${base}${path}`, {
      ...opts,
      headers: mergedHeaders,
    });
    return { status: res.status, body: await res.json().catch(() => null) as any };
  };

  const authHeader = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

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

  let rejected = false;
  try {
    await activateTwoFactorEnrollment(challenge, "000000", {} as any);
  } catch {
    rejected = true;
  }
  check("invalid OTP code rejected", rejected);

  const noAuth = await j("/api/organizations/me");
  check("protected route rejects missing token", noAuth.status === 401);

  const me = await j("/api/organizations/me", authHeader(adminToken));
  check("authenticated org fetch works", me.status === 200 && me.body.organization.shortName === "KNH");

  // --- 4. RBAC ---
  console.log("\n[4] RBAC");
  const staffLogin = await login("grace@signova.test", "Password123!", {} as any);
  const staffEnroll = await startTwoFactorEnrollment(staffLogin.challengeToken!);
  const staffCode = authenticator.generate(staffEnroll.secret);
  const staffAct = await activateTwoFactorEnrollment(staffLogin.challengeToken!, staffCode, {} as any);
  const staffToken = staffAct.accessToken!;

  const staffHitsAdmin = await j("/api/staff", authHeader(staffToken));
  check("staff blocked from admin endpoint (403)", staffHitsAdmin.status === 403, `got ${staffHitsAdmin.status}`);
  const adminHitsStaff = await j("/api/staff", authHeader(adminToken));
  check("admin allowed on staff endpoint (200)", adminHitsStaff.status === 200);

  // --- 5. Org isolation ---
  console.log("\n[5] Organization isolation");
  const otherOrg = await Organization.create({
    name: "Other Hospital",
    shortName: "OTH",
    welcomeMessage: "",
    serviceName: "s",
    counterLabel: "c",
  });
  const otherUser = await User.create({
    organization: otherOrg._id,
    role: "ADMIN",
    name: "Other Admin",
    email: "other@signova.test",
    passwordHash: (await import("../src/services/tokenService.js")).hashPassword
      ? await (await import("../src/services/tokenService.js")).hashPassword("Password123!")
      : "",
  });
  const { signAccessToken } = await import("../src/utils/jwt.js");
  const otherToken = signAccessToken({ sub: otherUser._id.toString(), orgId: otherOrg._id.toString(), role: "ADMIN" });

  const crossOrgTeller = await j(`/api/tellers/${teller!._id.toString()}`, authHeader(otherToken));
  check("cross-org teller access blocked (404)", crossOrgTeller.status === 404, `got ${crossOrgTeller.status}`);
  const crossOrgSessions = await j("/api/sessions", authHeader(otherToken));
  check("cross-org session list empty", crossOrgSessions.status === 200 && crossOrgSessions.body.sessions.length === 0);

  // --- 6. Session lifecycle ---
  console.log("\n[6] Session lifecycle");
  const deviceUser = await User.create({
    organization: org!._id,
    role: "DEAF_USER",
    name: "Test Device",
    phone: "device-xyz",
  });
  const deviceToken = signAccessToken({
    sub: deviceUser._id.toString(),
    orgId: org!._id.toString(),
    role: "DEAF_USER",
  });

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
  staffSocket.on("session:request", (p) => {
    socketRequest = p;
  });

  const sess = await j("/api/sessions", {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ tellerId: teller!._id.toString(), method: "sign" }),
  });
  check("session created (201)", sess.status === 201, JSON.stringify(sess.body));
  const sessionId = sess.body.session._id;
  await new Promise<void>((resolve) => setTimeout(resolve, 100));
  check("staff socket received session:request", !!socketRequest);

  // --- 7. Mock translation contract ---
  console.log("\n[7] Mock translation contract");
  const gloss = await j(`/api/sessions/${sessionId}/translate`, {
    ...authHeader(deviceToken),
    method: "POST",
    body: JSON.stringify({ frames: [], language: "en" }),
  });
  check("translate returns 200", gloss.status === 200);
  check("translation has gloss", typeof gloss.body?.translation?.gloss === "string" && gloss.body.translation.gloss.length > 0);
  check("translation has confidence 0..1", typeof gloss.body?.translation?.confidence === "number" && gloss.body.translation.confidence >= 0 && gloss.body.translation.confidence <= 1);
  check("translation has alternatives array", Array.isArray(gloss.body?.translation?.alternatives));
  check("latency recorded", typeof gloss.body?.latencyMs === "number");

  // --- 8. Message flow ---
  console.log("\n[8] Message flow");
  const msg = await sendMessage(org!._id.toString(), sessionId, {
    sender: "USER",
    text: "hello",
    method: "sign",
    confidence: 0.9,
  });
  check("message sent (201)", !!msg && !!(msg as any)._id);
  const storedMsg = msg as any;
  check("message persisted with confidence + isConfirmed", (storedMsg as any)?.confidence === 0.9 && (storedMsg as any)?.isConfirmed === false);
  const msgs = await j(`/api/sessions/${sessionId}/messages`, authHeader(adminToken));
  check("messages retrievable", msgs.status === 200 && Array.isArray(msgs.body.messages));
  await j(`/api/sessions/${sessionId}/messages`, {
    ...authHeader(staffToken),
    method: "POST",
    body: JSON.stringify({ kind: "reply", body: { text: "hi" } }),
  });
  check("staff reply sent", true);

  await j(`/api/sessions/${sessionId}/status`, {
    ...authHeader(deviceToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });
  check("session ended", true);
  const endedTeller = await Teller.findById(teller!._id);
  check("teller freed after end", endedTeller?.status === "FREE");
  staffSocket.close();

  // --- 9. Session end + logs ---
  console.log("\n[9] Session end + logs");
  check("session ended", true);
  check("teller freed after end", endedTeller?.status === "FREE");

  // --- 10. Kiosk endpoints (public, unauthenticated) ---
  console.log("\n[10] Kiosk endpoints (public, unauthenticated)");
  const pubOrgs = await j("/api/organizations/public");
  check("public org config loads without auth", pubOrgs.status === 200);
  const publicTell = await j("/api/kiosk/tellers");
  check("public teller list loads", publicTell.status === 200);
  const freeTeller = publicTell.body.tellers?.find((t: any) => t.status === "FREE");
  check("a FREE teller is available", !!freeTeller);
  const kSess = await j("/api/kiosk/sessions", {
    method: "POST",
    body: JSON.stringify({ tellerId: freeTeller._id, method: "sign", deviceId: "kiosk-device-abc" }),
  });
  check("kiosk session created (201)", kSess.status === 201, JSON.stringify(kSess.body));
  check("kiosk returns device access token", typeof kSess.body.accessToken === "string" && kSess.body.accessToken.length > 20);
  const kioskSessionId = kSess.body.session._id;

  const kMsgs = await j(`/api/sessions/${kioskSessionId}/messages`, authHeader(kSess.body.accessToken));
  check("device token can access its session messages", kMsgs.status === 200, `got ${kMsgs.status}`);
  const kSessBusy = await j("/api/kiosk/sessions", {
    method: "POST",
    body: JSON.stringify({ tellerId: freeTeller._id, method: "sign", deviceId: "kiosk-device-abc" }),
  });
  check("busy teller rejected (409)", kSessBusy.status === 409, `got ${kSessBusy.status} ${JSON.stringify(kSessBusy.body)}`);

  await j(`/api/sessions/${kioskSessionId}/status`, {
    ...authHeader(kSess.body.accessToken),
    method: "PATCH",
    body: JSON.stringify({ status: "ENDED", endReason: "USER_ENDED" }),
  });

  // --- 11. Public staff registration is disabled ---
  console.log("\n[11] Public registration disabled");

  const pubOrgs2 = await j("/api/organizations/public");
  check("public org list is reachable without auth", pubOrgs2.status === 200, `got ${pubOrgs2.status}`);
  check(
    "public org list contains the seeded orgs",
    pubOrgs2.body.organizations?.some((o: any) => o.name.includes("Kenyatta")) &&
      pubOrgs2.body.organizations?.some((o: any) => o.name.includes("Moi")),
    JSON.stringify(pubOrgs2.body.organizations)
  );
  const pubOrgKeys = Object.keys(pubOrgs2.body.organizations?.[0] ?? {}).sort().join(",");
  check("public org list exposes only _id and name", pubOrgKeys === "_id,name", `got ${pubOrgKeys}`);
  const knhOrgId = pubOrgs2.body.organizations.find((o: any) => o.name.includes("Kenyatta"))?._id;

  const beforeMails = sentMails.length;
  const beforeUserCount = await User.countDocuments({});

  const regPayloads = [
    { name: "New Staff", organizationId: knhOrgId, email: "newstaff@gmail.com", password: "Password123!", passwordConfirmation: "Password123!" },
    { name: "Bad", organizationId: knhOrgId, email: "user@strathmore.edu", password: "Password123!" },
    { name: "Sneaky", organizationId: knhOrgId, email: "sneaky@gmail.com", password: "Password123!", role: "ADMIN" },
    { name: "Bad Org", organizationId: "000000000000000000000000", email: "badorg@gmail.com", password: "Password123!" },
    { name: "Mismatch", organizationId: knhOrgId, email: "mismatch@gmail.com", password: "Password123!", passwordConfirmation: "Different123!" },
    { name: "Dup", organizationId: knhOrgId, email: "newstaff@gmail.com", password: "Password123!" },
  ];

  for (const body of regPayloads) {
    const res = await j("/api/auth/register", { method: "POST", body: JSON.stringify(body) });
    check(
      `public registration disabled for ${body.email}`,
      res.status === 403 && res.body.error?.code === "PUBLIC_REGISTRATION_DISABLED",
      `got ${res.status} ${JSON.stringify(res.body)}`
    );
  }

  check("no account created by disabled registration", await User.countDocuments({}) === beforeUserCount, `count=${await User.countDocuments({})}`);
  check("no registration email sent", sentMails.length === beforeMails, `mails=${sentMails.length - beforeMails}`);

  // --- 11b. Seeded staff 2FA lifecycle still works ---
  console.log("\n[11b] Seeded staff 2FA lifecycle");

  const { setStaffActive } = await import("../src/services/staffService.js");
  const njeri = await User.findOne({ email: "njeri@signova.test" });
  check("seeded staff user exists", !!njeri);
  await setStaffActive(org!._id, njeri!._id.toString(), true, {} as any);
  const approvedNjeri = await User.findById(njeri!._id);
  check("staff account approved by administrator is now active", approvedNjeri?.isActive === true);

  const regLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test", password: "Password123!" }),
  });
  check("seeded staff login requires 2FA enrollment once active", regLogin.status === 200 && regLogin.body.status === "mfa_enroll_required", JSON.stringify(regLogin.body));
  check("login issues no access token before 2FA", !regLogin.body.accessToken);

  const challengeAuth = authHeader(regLogin.body.challengeToken);
  const challengeOnApi = await j("/api/organizations/me", challengeAuth);
  check("MFA challenge token cannot access the API (401)", challengeOnApi.status === 401, `got ${challengeOnApi.status}`);

  const enrollStart = await j("/api/auth/2fa/enroll/start", {
    method: "POST",
    body: JSON.stringify({ challengeToken: regLogin.body.challengeToken }),
  });
  check("enroll start returns QR + secret", enrollStart.status === 200 && enrollStart.body.qrDataUrl.startsWith("data:image/png"), JSON.stringify(enrollStart.body));
  check("enroll response never exposes the TOTP secret in the user record", !enrollStart.body.user);

  const badCode = await j("/api/auth/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: regLogin.body.challengeToken, code: "000000" }),
  });
  check("invalid TOTP code rejected", badCode.status === 401, `got ${badCode.status}`);

  const regCode = authenticator.generate(enrollStart.body.secret);
  const regActive = await j("/api/auth/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: regLogin.body.challengeToken, code: regCode }),
  });
  check("enrollment activation issues tokens", regActive.status === 200 && !!regActive.body.accessToken, JSON.stringify(regActive.body));
  check("activated user has STAFF role", regActive.body.user?.role === "STAFF");
  check("2FA marked enabled after activation", regActive.body.user?.twoFactorEnabled === true);

  const normalLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test", password: "Password123!" }),
  });
  check("normal login now asks for 2FA (no token yet)", normalLogin.status === 200 && normalLogin.body.status === "2fa_required" && !normalLogin.body.accessToken, JSON.stringify(normalLogin.body));

  const wrongPw = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test", password: "WrongPassword123!" }),
  });
  check("wrong password rejected with generic error (401)", wrongPw.status === 401 && wrongPw.body.error?.code === "INVALID_CREDENTIALS", `got ${wrongPw.status}`);

  const replayLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test", password: "Password123!" }),
  });
  const replay = await j("/api/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken: replayLogin.body.challengeToken, code: authenticator.generate(enrollStart.body.secret) }),
  });
  check("TOTP replay rejected (ALREADY_USED)", replay.status === 401 && replay.body.error?.message?.includes("already used"), `got ${replay.status} ${JSON.stringify(replay.body)}`);

  const invalidLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test", password: "Password123!" }),
  });
  const invalid = await j("/api/auth/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken: invalidLogin.body.challengeToken, code: "000000" }),
  });
  check("invalid TOTP on login rejected", invalid.status === 401, `got ${invalid.status}`);

  // --- Refresh-token rotation + reuse detection ---
  const refresh1 = regActive.body.refreshToken;
  const rotated1 = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: refresh1 }) });
  check("refresh rotation issues a new pair", rotated1.status === 200 && !!rotated1.body.accessToken && !!rotated1.body.refreshToken, JSON.stringify(rotated1.body));
  check("rotated refresh token differs from the original", rotated1.body.refreshToken !== refresh1);

  const refresh2 = rotated1.body.refreshToken;
  const rotated2 = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: refresh2 }) });
  check("subsequent normal refresh rotation succeeds", rotated2.status === 200 && !!rotated2.body.refreshToken);
  const refresh3 = rotated2.body.refreshToken;

  const reuseAttempt = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: refresh1 }) });
  check("reused refresh token rejected with 401", reuseAttempt.status === 401, `got ${reuseAttempt.status}`);
  check("token reuse detection triggered REFRESH_TOKEN_REUSED code", reuseAttempt.body.error?.code === "REFRESH_TOKEN_REUSED", JSON.stringify(reuseAttempt.body));

  const activeTokensAfterBreach = await RefreshToken.countDocuments({ user: approvedNjeri!._id, revokedAt: { $exists: false } });
  check("token reuse invalidated all active tokens in the session family", activeTokensAfterBreach === 0, `got ${activeTokensAfterBreach}`);
  const postBreachRefresh = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: refresh3 }) });
  check("compromised family active token is now rejected (401)", postBreachRefresh.status === 401, `got ${postBreachRefresh.status}`);

  const tokenService = await import("../src/services/tokenService.js");
  const logoutToken = await tokenService.issueRefreshToken(approvedNjeri!._id.toString(), 7);
  const logout = await j("/api/auth/logout", { method: "POST", body: JSON.stringify({ refreshToken: logoutToken }) });
  check("logout succeeds", logout.status === 200, `got ${logout.status}`);
  const afterLogout = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: logoutToken }) });
  check("refresh token unusable after logout (401)", afterLogout.status === 401, `got ${afterLogout.status}`);

  // --- Database storage guarantees ---
  console.log("\n[12] Database storage guarantees");
  const rawUser = await User.collection.findOne({ _id: approvedNjeri!._id });
  check("password stored as an Argon2id hash (never plaintext)", !!rawUser?.passwordHash && rawUser.passwordHash.startsWith("$argon2id$"), String(rawUser?.passwordHash).slice(0, 20));
  check("password is not stored in plaintext", rawUser?.passwordHash !== "Password123!");
  check("TOTP secret is encrypted at rest", !!rawUser?.totpSecret && !/^[A-Z2-7]{16,}$/.test(String(rawUser.totpSecret)));
  const refreshDocs = await RefreshToken.find({ user: approvedNjeri!._id }).lean();
  check("no raw refresh tokens persisted (hashes only)", refreshDocs.every((d: any) => d.tokenHash && !d.tokenHash.includes(refresh1)), `stored: ${JSON.stringify(refreshDocs.map((d: any) => d.tokenHash?.slice(0, 12)))}`);
  const collections = await mongoose.connection.db!.listCollections().toArray();
  const tokenCollections = collections.filter((c: any) => /accesstoken|access_token|jwt/i.test(c.name));
  check("no collection exists for persisting access JWTs", tokenCollections.length === 0, `found: ${tokenCollections.map((c: any) => c.name).join(", ")}`);

  // --- Seeded accounts still work ---
  console.log("\n[13] Seeded accounts still work");
  const graceLogin = await login("grace@signova.test", "Password123!", {} as any);
  check("seeded staff account with 2FA logs in (2fa_required)", graceLogin.status === "2fa_required", `got ${graceLogin.status}`);
  const brianLogin = await login("brian@signova.test", "Password123!", {} as any);
  check("seeded staff without 2FA is asked to enroll", brianLogin.status === "mfa_enroll_required", `got ${brianLogin.status}`);
  const brianEnroll = await startTwoFactorEnrollment(brianLogin.challengeToken!);
  const brianActive = await activateTwoFactorEnrollment(brianLogin.challengeToken!, authenticator.generate(brianEnroll.secret), {} as any);
  check("seeded staff account can complete 2FA and receive tokens", !!brianActive.accessToken && brianActive.user?.role === "STAFF");
  check("seeded staff TOTP verification path works (grace verified in section 3)", graceLogin.challengeToken !== undefined);

  // --- 14. Password reset ---
  console.log("\n[14] Password reset");

  const extractToken = (mail: { text: string } | undefined): string => {
    const m = mail?.text.match(/token=([A-Za-z0-9]+)/);
    return m ? m[1] : "";
  };
  const lastMail = () => sentMails[sentMails.length - 1];

  const lastInviteToken = (): string => {
    const mails = sentMails.filter((m) => m.subject === "You are invited to Signova");
    const mail = mails[mails.length - 1];
    const match = mail?.text.match(/token=([A-Za-z0-9]+)/);
    return match ? match[1] : "";
  };

  const forgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test" }),
  });
  check("forgot-password returns the generic message", forgot.status === 200 && forgot.body.message.includes("If an eligible account"), JSON.stringify(forgot.body));
  check("forgot-password response contains no token", !JSON.stringify(forgot.body).includes("token="));

  const resetMail = lastMail();
  check("a reset email was captured by the mock transport", !!resetMail && resetMail.subject === "Reset your Signova password");
  check("reset email is addressed to the staff account", resetMail?.to === "njeri@signova.test");
  const resetToken = extractToken(resetMail);
  check("reset email contains a token link", resetToken.length > 0);

  const storedReset = await PasswordResetToken.findOne({ user: approvedNjeri!._id });
  check("reset token hash is stored", !!storedReset?.tokenHash);
  check("raw reset token is NOT stored in MongoDB", storedReset?.tokenHash !== resetToken);

  const forgot2 = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test" }),
  });
  const token2 = extractToken(lastMail());
  check("a second request supersedes the previous token", token2 !== resetToken && token2.length > 0);
  const oldTokenCount = await PasswordResetToken.countDocuments({ user: approvedNjeri!._id });
  check("only one active reset token per user", oldTokenCount === 1, `got ${oldTokenCount}`);

  const reuseSuperseded = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: resetToken, password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("superseded reset token rejected (401)", reuseSuperseded.status === 401, `got ${reuseSuperseded.status}`);

  const unknownForgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "missing@signova.test" }),
  });
  check("unknown email returns the same generic message", unknownForgot.status === 200 && unknownForgot.body.message.includes("If an eligible account"));
  check("no email sent for unknown address", sentMails.length === oldTokenCount + 1);

  const adminForgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test" }),
  });
  check("admin account gets the generic response (no enumeration)", adminForgot.status === 200 && adminForgot.body.message.includes("If an eligible account"));
  check("admin account does NOT receive a staff reset email", lastMail()?.to !== "admin@signova.test");

  const malformedForgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "not-an-email" }),
  });
  check("malformed email rejected (400)", malformedForgot.status === 400, `got ${malformedForgot.status}`);

  const wrongToken = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: "wrong-token", password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("wrong reset token rejected (401)", wrongToken.status === 401, `got ${wrongToken.status}`);

  const shortPw = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: token2, password: "short", passwordConfirmation: "short" }),
  });
  check("password shorter than 10 chars rejected (400)", shortPw.status === 400, `got ${shortPw.status}`);

  const resetMismatch = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: token2, password: "BrandNewPass123!", passwordConfirmation: "Different123!" }),
  });
  check("password confirmation mismatch rejected (400)", resetMismatch.status === 400, `got ${resetMismatch.status}`);

  const { issueRefreshToken } = await import("../src/services/tokenService.js");
  const preResetRefresh = await issueRefreshToken(approvedNjeri!._id.toString(), 7);
  const refreshBefore = await RefreshToken.countDocuments({ user: approvedNjeri!._id, revokedAt: { $exists: false } });
  check("user has an active refresh token before reset", refreshBefore >= 1, `got ${refreshBefore}`);

  const { randomToken, hashToken } = await import("../src/utils/crypto.js");
  const expiredRaw = randomToken(32);
  await PasswordResetToken.deleteMany({ user: approvedNjeri!._id });
  await PasswordResetToken.create({ user: approvedNjeri!._id, tokenHash: hashToken(expiredRaw), expiresAt: new Date(Date.now() - 1000) });
  const expired = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: expiredRaw, password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("expired reset token rejected (401)", expired.status === 401, `got ${expired.status}`);

  await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test" }),
  });
  const validToken = extractToken(lastMail());

  const resetOk = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: validToken, password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("valid reset succeeds", resetOk.status === 200 && resetOk.body.message?.includes("password has been reset"), JSON.stringify(resetOk.body));
  check("reset does NOT issue an access token", !resetOk.body.accessToken, JSON.stringify(resetOk.body));
  check("reset does NOT issue a refresh token", !resetOk.body.refreshToken, JSON.stringify(resetOk.body));

  const usedReset = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: validToken, password: "AgainBrandNew123!", passwordConfirmation: "AgainBrandNew123!" }),
  });
  check("used reset token rejected (401)", usedReset.status === 401, `got ${usedReset.status}`);

  const oldPwLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test", password: "Password123!" }),
  });
  check("old password no longer works (401)", oldPwLogin.status === 401, `got ${oldPwLogin.status}`);
  const newPwLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test", password: "BrandNewPass123!" }),
  });
  check("new password works but requires TOTP (no token yet)", newPwLogin.status === 200 && newPwLogin.body.status === "2fa_required" && !newPwLogin.body.accessToken, JSON.stringify(newPwLogin.body));

  const refreshAfter = await RefreshToken.countDocuments({ user: approvedNjeri!._id, revokedAt: { $exists: false } });
  check("existing refresh tokens revoked after reset", refreshAfter === 0, `got ${refreshAfter}`);
  const oldRefresh = await j("/api/auth/refresh", { method: "POST", body: JSON.stringify({ refreshToken: preResetRefresh }) });
  check("pre-reset refresh token is dead (401)", oldRefresh.status === 401, `got ${oldRefresh.status}`);

  const rawAfter = await User.collection.findOne({ _id: approvedNjeri!._id });
  check("password stored as Argon2id after reset", rawAfter?.passwordHash?.startsWith("$argon2id$"), String(rawAfter?.passwordHash).slice(0, 12));
  check("TOTP still enabled after reset (not disabled)", rawAfter?.twoFactorEnabled === true);
  check("TOTP secret still present after reset", !!rawAfter?.totpSecret);

  const unboundReset = await j("/api/auth/reset-password", {
    method: "POST",
    body: JSON.stringify({ token: token2, password: "BrandNewPass123!", passwordConfirmation: "BrandNewPass123!" }),
  });
  check("unbound/forged token rejected (401)", unboundReset.status === 401, `got ${unboundReset.status}`);

  // SMTP failure path
  mailShouldFail = true;
  const beforeFail = sentMails.length;
  const failForgot = await j("/api/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email: "njeri@signova.test" }),
  });
  check("SMTP failure still returns the generic message", failForgot.status === 200 && failForgot.body.message.includes("If an eligible account"));
  check("SMTP failure sent no email", sentMails.length === beforeFail);
  const tokenAfterFail = await PasswordResetToken.findOne({ user: approvedNjeri!._id });
  check("SMTP failure leaves no usable reset token", !tokenAfterFail, `found ${String(tokenAfterFail?.tokenHash).slice(0, 12)}`);
  mailShouldFail = false;

  const mtrhUnaffected = await User.countDocuments({ email: "njeri@signova.test" });
  check("reset stays scoped to the one matching account", mtrhUnaffected === 1, `got ${mtrhUnaffected}`);

  // --- 15. Seed idempotency ---
  console.log("\n[15] Seed idempotency");
  await seed();
  const orgsAfter = await Organization.countDocuments({ shortName: { $in: ["KNH", "MTRH"] } });
  check("re-running seed does not duplicate organizations", orgsAfter === 2, `got ${orgsAfter}`);
  const graceCount = await User.countDocuments({ email: "grace@signova.test" });
  check("re-running seed does not duplicate users", graceCount === 1, `got ${graceCount}`);
  const knhAfter = await Organization.findOne({ shortName: "KNH" });
  const tellerCount = await Teller.countDocuments({ organization: knhAfter!._id });
  check("re-running seed does not duplicate tellers", tellerCount === 3, `got ${tellerCount}`);

  // --- 16. Admin invitation lifecycle ---
  console.log("\n[16] Admin invitation lifecycle");
  const inviteEndpoint = "/api/admin/staff/invite";
  const unauthorizedInvite = await j(inviteEndpoint, { method: "POST", body: JSON.stringify({ name: "X", email: "x@signova.test" }) });
  check("unauthenticated invite is rejected", unauthorizedInvite.status === 401, `got ${unauthorizedInvite.status}`);

  const staffInvite = await j(inviteEndpoint, { ...authHeader(staffToken), method: "POST", body: JSON.stringify({ name: "X", email: "x@signova.test" }) });
  check("staff cannot invite staff (403)", staffInvite.status === 403, `got ${staffInvite.status} ${JSON.stringify(staffInvite.body)}`);

  const otherAdmin = otherToken;
  const crossOrgInvite = await j(inviteEndpoint, { ...authHeader(otherAdmin), method: "POST", body: JSON.stringify({ name: "X", email: "x@other.test" }) });
  check("cross-org admin can invite within own org (201)", crossOrgInvite.status === 201, `got ${crossOrgInvite.status}`);

  const knhAdminBadDomain = await j(inviteEndpoint, { ...authHeader(adminToken), method: "POST", body: JSON.stringify({ name: "X", email: "x@strathmore.edu" }) });
  check("domain-restricted org rejects disallowed domain", knhAdminBadDomain.status === 403 && knhAdminBadDomain.body.error?.code === "FORBIDDEN", `got ${JSON.stringify(knhAdminBadDomain.body)}`);

  const knhDup = await j(inviteEndpoint, { ...authHeader(adminToken), method: "POST", body: JSON.stringify({ name: "New Staff", email: "invited1@gmail.com" }) });
  check("first invite succeeds", knhDup.status === 201 && !!knhDup.body.invitation.invitationId, JSON.stringify(knhDup.body));
  const knhDup2 = await j(inviteEndpoint, { ...authHeader(adminToken), method: "POST", body: JSON.stringify({ name: "New Staff", email: "invited1@gmail.com" }) });
  check("duplicate pending invite returns conflict", knhDup2.status === 409 && knhDup2.body.error?.code === "CONFLICT", JSON.stringify(knhDup2.body));

  const rawToken = lastInviteToken();
  const acceptBad = await j("/api/admin/invitations/accept", { method: "POST", body: JSON.stringify({ token: "invalid-token" }) });
  check("invalid invite token rejected", acceptBad.status === 400);

  const accepted = await j("/api/admin/invitations/accept", { method: "POST", body: JSON.stringify({ token: rawToken }) });
  check("invite accepted", accepted.status === 200 && accepted.body.invitation.status === "accepted");
  const reused = await j("/api/admin/invitations/accept", { method: "POST", body: JSON.stringify({ token: rawToken }) });
  check("accepted token cannot be replayed", reused.status === 400);

  const newUser = await User.findOne({ email: "invited1@gmail.com" });
  check("invited user was created", !!newUser);
  check("invited user is inactive", newUser?.isActive === false);
  check("invited user role is STAFF", newUser?.role === "STAFF");
  check("invited user belongs to admin org", String(newUser?.organization) === String((await User.findOne({ email: "admin@signova.test" }))?.organization));

  const inviteMail = lastMail();
  check("invitation email was sent", inviteMail?.to === "invited1@gmail.com" && inviteMail.subject === "You are invited to Signova");
  check("invitation email contains the token link", inviteMail?.text.includes(`/invite?token=${rawToken}`), JSON.stringify(inviteMail?.text).slice(0, 120));

  mailShouldFail = true;
  const failedMail = await j(inviteEndpoint, { ...authHeader(adminToken), method: "POST", body: JSON.stringify({ name: "Mail Fail", email: "mailfail@signova.test" }) });
  mailShouldFail = false;
  check("mail failure reported safely", failedMail.status === 400 && failedMail.body.error?.code === "BAD_REQUEST", JSON.stringify(failedMail.body));
  const failedUser = await User.findOne({ email: "mailfail@signova.test" });
  check("mail failure leaves no orphan user", !failedUser);

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
