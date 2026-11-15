/**
 * Focused bootstrap + invitation security tests.
 *
 * Run: node --import tsx test/bootstrap.test.ts
 */

import { MongoMemoryServer } from "mongodb-memory-server";

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
process.env.PASSWORD_RESET_BASE_URL = "http://localhost:5173";
process.env.ADMIN_PORTAL_URL = "http://localhost:5174";

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
  const { acceptBootstrap, activateBootstrap } = await import("../src/admin/services/bootstrapService.js");
  const { createInvitation, acceptInvitation } = await import("../src/admin/services/invitationService.js");
  const { setMailTransport } = await import("../src/services/mailService.js");
  const { signAccessToken, signChallengeToken } = await import("../src/utils/jwt.js");
  const { decryptSecret } = await import("../src/utils/crypto.js");
  const { randomToken, hashToken } = await import("../src/utils/crypto.js");
  const { authenticator } = await import("otplib");
  const { User } = await import("../src/models/user.js");
  const { Organization } = await import("../src/models/organization.js");
  const { SetupToken } = await import("../src/models/setupToken.js");
  const { Invitation } = await import("../src/models/invitation.js");
  const { Teller } = await import("../src/models/teller.js");
  const express = (await import("express")).default;
  const { createServer } = await import("node:http");

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
  await seed();

  const adminRoutes = (await import("../src/admin/index.js")).default;
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
  app.use("/api/admin", adminRoutes);
  app.use(notFoundHandler);
  app.use(errorHandler);

  const server = createServer(app);
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
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };

  const authHeader = (token: string) => ({ headers: { authorization: `Bearer ${token}` } });

  // --- 1. Seed preservation ---
  console.log("\n[1] Seed preservation");
  await seed();

  const knh = await Organization.findOne({ shortName: "KNH" });
  check("KNH org exists", !!knh);

  const adminBefore = await User.findOne({ email: "admin@signova.test" }).select("+passwordHash");
  check("admin account preserved", !!adminBefore && adminBefore.isActive === true);
  check("admin password preserved", !!adminBefore?.passwordHash && String(adminBefore.passwordHash).startsWith("$argon2id$"));

  const graceBefore = await User.findOne({ email: "grace@signova.test" }).select("+passwordHash");
  check("seeded staff preserved", !!graceBefore && graceBefore.role === "STAFF");

  const tellersBefore = await Teller.find({ organization: knh!._id });
  check("tellers preserved", tellersBefore.length === 3, `got ${tellersBefore.length}`);

  const assignmentsBefore = tellersBefore.filter((t) => !!t.staffUser).length;
  check("teller assignments preserved", assignmentsBefore === 3, `got ${assignmentsBefore}`);

  const mfaBefore = await User.findOne({ email: "admin@signova.test" });
  check("existing MFA state untouched on rerun", mfaBefore?.twoFactorEnabled === false);

  // --- 2. Bootstrap endpoint contract ---
  console.log("\n[2] Bootstrap endpoint contract");
  const badScope = await j("/api/admin/bootstrap/accept", {
    method: "POST",
    body: JSON.stringify({ token: "invalid-token", password: "Password123!" }),
  });
  check("invalid bootstrap token rejected", badScope.status === 400);

  // --- 3. Bootstrap real happy path ---
  console.log("\n[3] Bootstrap happy path");
  const setupRaw = randomToken(32);
  const setupHash = hashToken(setupRaw);
  await SetupToken.create({
    user: (await User.findOne({ email: "crystal.kanana@strathmore.edu" }))!._id,
    tokenHash: setupHash,
    scope: "bootstrap",
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });

  const accept = await j("/api/admin/bootstrap/accept", {
    method: "POST",
    body: JSON.stringify({ token: setupRaw, password: "BootstrapPass123!" }),
  });
  check("bootstrap accept returns mfa_enroll_required", accept.status === 200 && accept.body.status === "mfa_enroll_required", JSON.stringify(accept.body));
  const bootstrapChallenge = accept.body.challengeToken;

  const enrollData = await j("/api/admin/2fa/enroll/start", {
    method: "POST",
    body: JSON.stringify({ challengeToken: bootstrapChallenge }),
  });
  check("bootstrap enroll/start succeeds after accept", enrollData.status === 200 && !!enrollData.body.qrDataUrl, JSON.stringify(enrollData.body));

  const invalidActivate = await j("/api/admin/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: bootstrapChallenge, code: "000000" }),
  });
  check("invalid TOTP rejected during bootstrap", invalidActivate.status === 401 || invalidActivate.status === 400, `got ${invalidActivate.status} ${JSON.stringify(invalidActivate.body)}`);

  const crystalBefore = await User.findOne({ email: "crystal.kanana@strathmore.edu" }).select("+totpSecret");
  const secret = decryptSecret(crystalBefore!.totpSecret!);
  const code = authenticator.generate(secret);

  const activate = await j("/api/admin/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: bootstrapChallenge, code }),
  });
  check("bootstrap activate succeeds", activate.status === 200 && activate.body.status === "authenticated", JSON.stringify(activate.body));
  check("bootstrap activate issues access token", !!activate.body.accessToken);
  check("bootstrap activate issues refresh token", !!activate.body.refreshToken);

  const activeAfter = await User.findOne({ email: "crystal.kanana@strathmore.edu" }).select("+totpSecret");
  check("bootstrap account is active", activeAfter?.isActive === true);
  check("bootstrap account has 2FA enabled", activeAfter?.twoFactorEnabled === true);

  const loginAfter = await j("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "crystal.kanana@strathmore.edu", password: "BootstrapPass123!" }),
  });
  check("activated bootstrap admin can login with 2FA challenge", loginAfter.status === 200 && loginAfter.body.status === "2fa_required" && !!loginAfter.body.challengeToken, JSON.stringify(loginAfter.body));

  // --- 3a. Bootstrap enrollment recovery ---
  console.log("\n[3a] Bootstrap enrollment recovery");
  const recoverySetupRaw = randomToken(32);
  const recoverySetupHash = hashToken(recoverySetupRaw);
  await SetupToken.create({
    user: (await User.findOne({ email: "crystal.kanana@strathmore.edu" }))!._id,
    tokenHash: recoverySetupHash,
    scope: "bootstrap",
    expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
  });

  const recoveryAccept = await j("/api/admin/bootstrap/accept", {
    method: "POST",
    body: JSON.stringify({ token: recoverySetupRaw, password: "RecoveryPass123!" }),
  });
  check("recovery bootstrap accept returns mfa_enroll_required", recoveryAccept.status === 200 && recoveryAccept.body.status === "mfa_enroll_required", JSON.stringify(recoveryAccept.body));
  const recoveryChallenge = recoveryAccept.body.challengeToken;

  const recoveryEnroll = await j("/api/admin/2fa/enroll/start", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryChallenge }),
  });
  check("initial recovery enroll/start succeeds", recoveryEnroll.status === 200 && !!recoveryEnroll.body.qrDataUrl, JSON.stringify(recoveryEnroll.body));
  const oldInitialSecret = recoveryEnroll.body.secret;

  const recoveryReissue = await j("/api/admin/bootstrap/recover-enrollment", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryChallenge, password: "RecoveryPass123!" }),
  });
  check("recovery endpoint returns new QR data", recoveryReissue.status === 200 && !!recoveryReissue.body.qrDataUrl, JSON.stringify(recoveryReissue.body));
  const newSecret = recoveryReissue.body.secret;

  const crystalAfterRecover = await User.findOne({ email: "crystal.kanana@strathmore.edu" }).select("+totpSecret +totpLastUsedStep");
  check("totpLastUsedStep cleared after recovery", crystalAfterRecover?.totpLastUsedStep === undefined);
  check("stored secret changes after recovery", crystalAfterRecover?.totpSecret !== (await import("../src/utils/crypto.js")).encryptSecret(oldInitialSecret), `stored=${crystalAfterRecover?.totpSecret}`);
  check("new secret generates a valid code", typeof newSecret === "string" && !!authenticator.generate(newSecret));

  const invalidOldAfterRecover = await j("/api/admin/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryChallenge, code: authenticator.generate(oldInitialSecret) }),
  });
  check("old initial secret rejected after recovery", invalidOldAfterRecover.status === 400 || invalidOldAfterRecover.status === 401, `got ${invalidOldAfterRecover.status} ${JSON.stringify(invalidOldAfterRecover.body)}`);

  const invalidRecoveryVerify = await j("/api/admin/2fa/verify", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryChallenge, code: "000000" }),
  });
  check("invalid recovery code rejected", invalidRecoveryVerify.status === 401 || invalidRecoveryVerify.status === 400, `got ${invalidRecoveryVerify.status} ${JSON.stringify(invalidRecoveryVerify.body)}`);

  const recoveryActivate = await j("/api/admin/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryChallenge, code: authenticator.generate(newSecret) }),
  });
  check("recovery activation succeeds", recoveryActivate.status === 200 && recoveryActivate.body.status === "authenticated", JSON.stringify(recoveryActivate.body));

  const recoveryReplay = await j("/api/admin/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryChallenge, code: authenticator.generate(newSecret) }),
  });
  check("replayed recovery code rejected", recoveryReplay.status === 401 || recoveryReplay.status === 400, `got ${recoveryReplay.status} ${JSON.stringify(recoveryReplay.body)}`);

  const recoveryExpiredRaw = randomToken(32);
  const recoveryExpiredHash = hashToken(recoveryExpiredRaw);
  await SetupToken.create({
    user: (await User.findOne({ email: "crystal.kanana@strathmore.edu" }))!._id,
    tokenHash: recoveryExpiredHash,
    scope: "bootstrap",
    expiresAt: new Date(Date.now() - 1000),
  });
  const recoveryExpiredChallenge = signChallengeToken((await User.findOne({ email: "crystal.kanana@strathmore.edu" }))!._id.toString(), "mfa_enroll");
  const recoveryExpiredResp = await j("/api/admin/bootstrap/recover-enrollment", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryExpiredChallenge, password: "RecoveryPass123!" }),
  });
  check("expired recovery challenge rejected", recoveryExpiredResp.status === 400);

  const recoveryBadScope = signChallengeToken((await User.findOne({ email: "crystal.kanana@strathmore.edu" }))!._id.toString(), "2fa");
  const recoveryBadScopeResp = await j("/api/admin/bootstrap/recover-enrollment", {
    method: "POST",
    body: JSON.stringify({ challengeToken: recoveryBadScope, password: "RecoveryPass123!" }),
  });
  check("bad-scope recovery challenge rejected", recoveryBadScopeResp.status === 400);

  // --- 4. Bootstrap replay + expiry + scope ---
  console.log("\n[4] Bootstrap replay/expiry/scope");
  const replay = await j("/api/admin/bootstrap/accept", {
    method: "POST",
    body: JSON.stringify({ token: setupRaw, password: "Password123!" }),
  });
  check("bootstrap token replay rejected", replay.status === 400);

  const expiredRaw = randomToken(32);
  const expiredHash = hashToken(expiredRaw);
  await SetupToken.create({
    user: (await User.findOne({ email: "crystal.kanana@strathmore.edu" }))!._id,
    tokenHash: expiredHash,
    scope: "bootstrap",
    expiresAt: new Date(Date.now() - 1000),
  });
  const expired = await j("/api/admin/bootstrap/accept", {
    method: "POST",
    body: JSON.stringify({ token: expiredRaw, password: "Password123!" }),
  });
  check("expired bootstrap token rejected", expired.status === 400);

  const badScopeRaw = randomToken(32);
  await SetupToken.create({
    user: (await User.findOne({ email: "crystal.kanana@strathmore.edu" }))!._id,
    tokenHash: hashToken(badScopeRaw),
    scope: "password_setup",
    expiresAt: new Date(Date.now() + 1000 * 60 * 60),
  });
  const badScopeResp = await j("/api/admin/bootstrap/accept", {
    method: "POST",
    body: JSON.stringify({ token: badScopeRaw, password: "Password123!" }),
  });
  check("bad scope rejected", badScopeResp.status === 400);

  // --- 5. Bootstrap exception isolation ---
  console.log("\n[5] Bootstrap exception isolation");
  const knhOrg = await Organization.findOne({ shortName: "KNH" });
  check("KNH still restricts staff invites by domain", !!knhOrg?.restrictRegistrationByDomain);
  const badDomain = await createInvitation(knhOrg!._id, adminBefore!._id, { name: "X", email: "outside@strathmore.edu" }, {} as any).catch((e: any) => e);
  check("non-bootstrap domain invite rejected on KNH", badDomain?.statusCode === 403 || badDomain?.statusCode === 400, JSON.stringify(badDomain?.body || badDomain));

  // --- 6. Invitation concurrency ---
  console.log("\n[6] Invitation concurrency");
  const invite = await createInvitation(knh!._id, adminBefore!._id, { name: "Conc", email: "conc@signova.test" }, {} as any);
  const raw = randomToken(32);
  const inviteDoc = await Invitation.findOne({ _id: invite.invitationId });
  inviteDoc!.tokenHash = hashToken(raw);
  await inviteDoc!.save();

  const concurrencyPromises = Array.from({ length: 6 }).map(() =>
    acceptInvitation(raw, {} as any).then(
      (r) => ({ ok: true as const, user: r.user._id.toString() }),
      (e) => ({ ok: false as const, message: (e as Error).message }),
    ),
  );

  const concurrencyResults = await Promise.all(concurrencyPromises);
  const successes = concurrencyResults.filter((r) => r.ok);
  const failuresCount = concurrencyResults.filter((r) => !r.ok).length;
  check("concurrent invitation acceptance yields exactly one success", successes.length === 1 && failuresCount === 5, `successes=${successes.length} failures=${failuresCount}`);
  const acceptedUsers = await Invitation.find({ tokenHash: hashToken(raw), status: "accepted" });
  check("only one accepted invitation remains", acceptedUsers.length === 1, `got ${acceptedUsers.length}`);

  // --- 7. Mail failure cleanup ---
  console.log("\n[7] Bootstrap mail failure cleanup");
  mailShouldFail = true;
  try {
    await createInvitation(knh!._id, adminBefore!._id, { name: "Mail", email: "mailfail@signova.test" }, {} as any);
  } catch (e) {
    // expected
  }
  mailShouldFail = false;
  const orphan = await User.findOne({ email: "mailfail@signova.test" });
  check("mail failure leaves no orphan user", !orphan);

  console.log(`\n========================================`);
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  console.log(`========================================`);

  await mem.stop();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
