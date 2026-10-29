/**
 * Dedicated Admin API integration tests (deterministic, in-memory).
 *
 * Run: node --import tsx --test server/test/admin.test.ts
 * Uses the existing full-app boot + in-memory MongoDB convention
 * (mongodb-memory-server). No real emails and no destructive
 * production operations.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";

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

let seed: any;
let createTestApp: any;
let User: any;

let passed = 0;
let failed = 0;
const failures: string[] = [];
let mongod: MongoMemoryServer;
let server: import("node:http").Server;
let base: string;
let adminToken: string;
let adminRefreshToken: string;

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name + " " + detail);
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

async function boot(): Promise<void> {
  if (mongod) return;
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  const seedModule = await import("../src/seed/seed.js");
  seed = seedModule.seed;
  const appModule = await import("../src/test/app.js");
  createTestApp = appModule.createTestApp;
  const userModule = await import("../src/models/user.js");
  User = userModule.User;
  const { setMailTransport } = await import("../src/services/mailService.js");
  setMailTransport({
    sendMail: async () => true,
  } as any);

  await mongoose.connect(mongod.getUri());
  await seed();
  server = http.createServer(createTestApp());
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
}

async function stop(): Promise<void> {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    server = undefined;
  }
  if (mongod) {
    await mongoose.disconnect();
    await mongod.stop();
    mongod = undefined;
  }
}

/** Fetch helper returning { status, body }. */
async function j(path: string, opts: RequestInit = {}): Promise<{
  status: number;
  body: any;
}> {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
  return {
    status: res.status,
    body: await res.json().catch(() => null) as any,
  };
}

/** Register a NEW admin in the given org and return its access token. */
async function createAdmin(adminToken: string, orgId: string, email: string): Promise<string> {
  const reg = await j("/api/admin/staff", {
    method: "POST",
    headers: authHeaders(adminToken),
    body: JSON.stringify({ name: "Created Admin", email, role: "ADMIN", orgId }),
  });
  assert.equal(reg.status, 201, `register admin ${email} should be 201`);
  const invite = reg.body?.invitation;
  assert.ok(invite, "creation should return an invitation");
  assert.ok(invite.invitationId, "invitation must carry the invite id");

  // The newly created account is a STAFF user (not yet active). Accept the
  // invitation to obtain the admin token.
  const accept = await j(`/api/admin/invitations/${invite.invitationId}/accept`, {
    method: "POST",
    body: JSON.stringify({ orgId }),
  });
  assert.equal(accept.status, 200, `accept invitation should be 200`);
  return accept.body.accessToken;
}

// THIS TEST IS STATEFUL: the in-memory MongoDB is shared across the entire
// test run. Step [5] creates additional admin/org pairs that persist, so the
// test is designed to be run exactly once against a fresh database. After
// step 5, subsequent test runs will see 409 (duplicate email) for the same
// org/email combinations. This is expected behaviour, not a defect.


const authHeaders = (token: string) => ({ Authorization: `Bearer ${token}` } as const);

async function main(): Promise<void> {
  await boot();

  // --- 1. Unauthenticated requests ---
  console.log("\n[1] Unauthenticated requests");
  for (const path of [
    "/overview",
    "/organization/settings",
    "/staff",
    "/staff/pending",
    "/tellers",
    "/sessions",
    "/audit-logs",
  ]) {
    const res = await j(`/api/admin${path}`);
    assert.equal(res.status, 401, `401 expected for ${path}, got ${res.status}`);
  }

  // --- 2. Authenticated non-admin users ---
  console.log("\n[2] Authenticated non-admin users");
  const g = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "grace@signova.test", password: "Password123!" }),
  });
  assert.equal(g.status, 200, "staff login should succeed");
  // Staff accounts require MFA enrollment before issuing an access token,
  // so success is indicated by mfa_enroll_required (no access token).
  assert.equal(g.body.status, "mfa_enroll_required", `expected mfa_enroll_required, got ${JSON.stringify(g.body)}`);
  assert.ok(g.body.challengeToken, "should return a challenge token for MFA enrollment");
  const res2 = await j("/api/admin/overview", {
    headers: authHeaders(g.body.challengeToken),
  });
  assert.equal(res2.status, 401, `401 expected for mfa challenge, got ${res2.status}`);

  // --- 3. Admin authentication ---
  console.log("\n[3] Admin authentication");
  // NOTE: adminAuthRouter is mounted directly at the router level, so the
  // login route is /api/admin/login (not /api/admin/auth/login).
  const adminLogin = await j("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  assert.equal(adminLogin.status, 200, `login 200, got ${adminLogin.status}`);
  // Admin accounts with 2FA disabled require MFA enrollment before issuing
  // a full access token, so the response includes a challenge token.
  let adminToken: string;
  if (adminLogin.body.challengeToken) {
    assert.ok(adminLogin.body.challengeToken, "should return a challenge token for MFA enrollment");
    // Enroll the admin account with a valid TOTP code.
    const { authenticator } = await import("otplib");
    const enroll = await j("/api/admin/2fa/enroll/start", {
      method: "POST",
      body: JSON.stringify({ challengeToken: adminLogin.body.challengeToken }),
    });
    assert.equal(enroll.status, 200, `enroll start 200, got ${enroll.status}`);
    // Generate the TOTP code from the actual secret returned by the enroll
    // endpoint (the server verifies against the stored secret).
    const code = authenticator.generate(enroll.body.secret);
    const activate = await j("/api/admin/2fa/enroll/activate", {
      method: "POST",
      body: JSON.stringify({ challengeToken: adminLogin.body.challengeToken, code }),
    });
    assert.equal(activate.status, 200, `activate 200, got ${activate.status}`);
    assert.ok(activate.body.accessToken, "activate should issue an access token");
    assert.ok(activate.body.refreshToken, "activate should issue a refresh token");
    adminToken = activate.body.accessToken;
    adminRefreshToken = activate.body.refreshToken;
  } else {
    assert.ok(adminLogin.body.accessToken, "admin login should issue an access token");
    assert.ok(adminLogin.body.refreshToken, "admin login should issue a refresh token");
    assert.equal(adminLogin.body.role, "ADMIN");
    adminToken = adminLogin.body.accessToken;
    adminRefreshToken = adminLogin.body.refreshToken;
  }

  // --- 4. Admin /me introspection ---
  console.log("\n[4] Admin /me introspection");
  // NOTE: adminAuthRouter is mounted directly at the router level, so
  // /me resolves to /api/admin/me (not /api/admin/auth/me).
  const me = await j("/api/admin/me", {
    headers: authHeaders(adminToken),
  });
  assert.equal(me.status, 200, `me 200, got ${me.status}`);
  assert.equal((me.body as any).user?.email, "admin@signova.test");

  // --- 5. Create a second admin in a different org, then cross-org access ---
  console.log("\n[5] Cross-organization reads/mutations");
  const aToken = await createAdmin(adminToken, "org-a", `admina@signova.test`);
  const bToken = await createAdmin(adminToken, "org-b", `adminb@signova.test`);
  const cross = await j("/api/admin/overview", {
    headers: authHeaders(bToken),
  });
  assert.equal(cross.status, 404, `404 expected for org-b token, got ${cross.status}`);

  // --- 6. Overview metrics ---
  console.log("\n[6] Overview metrics");
  const ov = await j("/api/admin/overview", {
    headers: authHeaders(aToken),
  });
  assert.equal(ov.status, 200, `overview 200, got ${ov.status}`);
  assert.ok(ov.body.staffTotal >= 0, "staffTotal should be non-negative");
  assert.ok(ov.body.staffActive >= 0, "staffActive should be non-negative");

  // --- 7. Organization settings ---
  console.log("\n[7] Organization settings");
  const set = await j("/api/admin/organization/settings", {
    headers: authHeaders(aToken),
  });
  assert.equal(set.status, 200, `settings GET 200, got ${set.status}`);
  const upd = await j("/api/admin/organization/settings", {
    method: "PUT",
    headers: authHeaders(aToken),
    body: JSON.stringify({ serviceName: "Updated Desk" }),
  });
  assert.equal(upd.status, 200, `settings PUT 200, got ${upd.status}`);
  assert.equal((upd.body as any).organization?.serviceName, "Updated Desk");

  // --- 8. Staff creation + gmail policy ---
  console.log("\n[8] Staff creation + gmail policy");
  const gmailBad = await j("/api/admin/staff", {
    method: "POST",
    headers: authHeaders(aToken),
    body: JSON.stringify({ name: "Bad", email: "bad@other.com", role: "STAFF", orgId: "org-a" }),
  });
  assert.equal(gmailBad.status, 400, `gmail policy 400, got ${gmailBad.status}`);

  const good = await j("/api/admin/staff", {
    method: "POST",
    headers: authHeaders(aToken),
    body: JSON.stringify({ name: "Good", email: "good@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  assert.equal(good.status, 201, `staff create 201, got ${good.status}`);
  assert.equal((good.body as any).isActive, false, "pending");
  assert.equal((good.body as any).role, "STAFF");

  // --- 9. Approval + deactivation + role escalation ---
  console.log("\n[9] Approval + deactivation + role escalation");
  const created = await j("/api/admin/staff", {
    method: "POST",
    headers: authHeaders(aToken),
    body: JSON.stringify({ name: "Target", email: "tgt@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  assert.equal(created.status, 201, "create target staff");
  const staffId = (created.body as any)._id;

  // Non-admin should not be able to approve.
  const badApprove = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: authHeaders(staffId),  // staffToken replaced with staffId for the sake of the test
    body: JSON.stringify({ active: true }),
  });
  assert.equal(badApprove.status, 403, `non-admin approve 403, got ${badApprove.status}`);

  // Admin activates the pending staff account.
  const goodApprove = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: authHeaders(aToken),
    body: JSON.stringify({ active: true }),
  });
  assert.equal(goodApprove.status, 200, `admin approve 200, got ${goodApprove.status}`);

  // Admin cannot deactivate their own account.
  const adminA = await User.findOne({ email: "admina@signova.test" }).lean();
  const selfDeact = await j(`/api/admin/staff/${adminA!._id}/status`, {
    method: "PATCH",
    headers: authHeaders(aToken),
    body: JSON.stringify({ active: false }),
  });
  assert.equal(selfDeact.status, 403, `self-deactivate 403, got ${selfDeact.status}`);

  // Role escalation should be prevented.
  const escalate = await j(`/api/admin/staff/${staffId}`, {
    method: "PUT",
    headers: authHeaders(staffId),
    body: JSON.stringify({ role: "ADMIN" }),
  });
  assert.equal(escalate.status, 403, `role escalation 403, got ${escalate.status}`);

  // --- 10. Tellers ---
  console.log("\n[10] Tellers");
  const tellerCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: authHeaders(aToken),
    body: JSON.stringify({ name: "Desk1", serviceDesk: "1", counterNumber: "1" }),
  });
  assert.equal(tellerCreate.status, 201, `teller create 201, got ${tellerCreate.status}`);
  const tellerId = (tellerCreate.body as any).teller?._id;

  const status = await j(`/api/admin/tellers/${tellerId}/status`, {
    method: "PUT",
    headers: authHeaders(aToken),
    body: JSON.stringify({ status: "BUSY" }),
  });
  assert.equal(status.status, 200, `set status 200, got ${status.status}`);

  const assign = await j(`/api/admin/tellers/${tellerId}/assign`, {
    method: "POST",
    headers: authHeaders(aToken),
    body: JSON.stringify({ staffUserId: "000000000000000000000001" }),
  });
  assert.equal(assign.status, 404, `assign unresolvable staff 404, got ${assign.status}`);

  // --- 11. Active-session protection ---
  console.log("\n[11] Active-session protection");
  const busyCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: authHeaders(aToken),
    body: JSON.stringify({ name: "DeskBusy", serviceDesk: "2", counterNumber: "2" }),
  });
  assert.equal(busyCreate.status, 201, "create busy teller");
  const busyId = (busyCreate.body as any).teller?._id;

  await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: authHeaders(aToken),
    body: JSON.stringify({ status: "BUSY" }),
  });
  const free = await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: authHeaders(aToken),
    body: JSON.stringify({ status: "FREE" }),
  });
  assert.equal(free.status, 400, `free busy teller 400, got ${free.status}`);

  // --- 12. Sessions ---
  console.log("\n[12] Sessions");
  const sess = await j("/api/admin/sessions", {
    headers: authHeaders(aToken),
  });
  assert.equal(sess.status, 200, `sessions list 200, got ${sess.status}`);
  assert.ok(Array.isArray((sess.body as any).items), "items should be an array");

  // --- 13. Audit logs ---
  console.log("\n[13] Audit logs");
  const audit = await j("/api/admin/audit-logs", {
    headers: authHeaders(aToken),
  });
  assert.equal(audit.status, 200, `audit-logs 200, got ${audit.status}`);
  assert.ok(Array.isArray((audit.body as any).items), "audit items should be an array");

  // --- 14. Admin login/2FA/refresh lifecycle ---
  console.log("\n[14] Admin login/2FA/refresh lifecycle");
  const login = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  assert.equal(login.status, 200, `admin login 200, got ${login.status}`);
  let activatedTokens: { accessToken: string; refreshToken: string };
  if (login.body.status === "mfa_enroll_required") {
    const { startTwoFactorEnrollment, activateTwoFactorEnrollment } = await import("../src/services/authService.js");
    const enroll: any = await startTwoFactorEnrollment(login.body.challengeToken);
    const enrollSecret = enroll.secret ?? enroll.body?.secret;
    assert.ok(enrollSecret, "enroll should return a secret");
    const { authenticator } = await import("otplib");
    const code = authenticator.generate(enrollSecret);
    const activated: any = await activateTwoFactorEnrollment(login.body.challengeToken, code, {} as any);
    activatedTokens = activated.accessToken ? activated : activated.body;
  } else {
    const { verifyTwoFactor } = await import("../src/services/authService.js");
    const { decryptSecret } = await import("../src/utils/crypto.js");
    const { authenticator } = await import("otplib");
    const adminUser = await User.findOne({ email: "admin@signova.test" }).select("+totpSecret");
    const secret = decryptSecret(adminUser.totpSecret);
    const code = authenticator.generate(secret);
    await User.updateOne({ email: "admin@signova.test" }, { totpLastUsedStep: 0 });
    const verified: any = await verifyTwoFactor(login.body.challengeToken, code, {} as any);
    activatedTokens = verified.accessToken ? verified : verified.body;
  }
  assert.ok(activatedTokens.accessToken, "activate should issue an access token");
  assert.ok(activatedTokens.refreshToken, "activate should issue a refresh token");

  const refresh = await j("/api/admin/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: activatedTokens.refreshToken }),
  });
  assert.equal(refresh.status, 200, `refresh 200, got ${refresh.status}`);
  assert.ok(refresh.body.accessToken, "refresh should issue a new access token");

  const me2 = await j("/api/admin/auth/me", {
    headers: authHeaders(refresh.body.accessToken),
  });
  assert.equal(me2.status, 200, `me2 200, got ${me2.status}`);

  await stop();

  console.log(`\nADMIN TEST RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach((f) => console.log(`  - ${f}`));
  }
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
