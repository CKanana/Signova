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

import { seed } from "../src/seed/seed.js";
import { createTestApp } from "../src/test/app.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];
let mongod: MongoMemoryServer;
let server: import("node:http").Server;
let base: string;

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

async function boot() {
  if (mongod) return;
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  await seed();
  server = createTestApp();
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  base = `http://127.0.0.1:${server.address?.().port}`;
}

async function stop() {
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
async function j(path: string, opts: RequestInit = {}) {
  const res = await fetch(`${base}${path}`, {
    ...opts,
    headers: { "content-type": "application/json", ...(opts.headers || {}) },
  });
  return { status: res.status, body: await res.json().catch(() => null) as any };
}

/**
 * Register a NEW admin in the given org and return its access token.
 *
 * Public registration is disabled, so we use the real admin-portal flow:
 * create a STAFF-account invite via POST /api/admin/staff, then the staff
 * account accepts it (the invite is what grants ADMIN role).
 */
async function createAdmin(orgId: string, email: string): Promise<string> {
  const reg = await j("/api/admin/staff", {
    method: "POST",
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

async function main() {
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
  const adminToken = g.body.accessToken;
  assert.ok(adminToken);
  const res2 = await j("/api/admin/overview", {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(res2.status, 403, `403 expected, got ${res2.status}`);

  // --- 3. Admin authentication ---
  console.log("\n[3] Admin authentication");
  const adminLogin = await j("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  assert.equal(adminLogin.status, 200, `login 200, got ${adminLogin.status}`);
  assert.ok(adminLogin.body.accessToken);
  assert.ok(adminLogin.body.refreshToken);
  assert.equal(adminLogin.body.role, "ADMIN");

  // --- 4. Admin /me introspection ---
  console.log("\n[4] Admin /me introspection");
  const me = await j("/api/admin/auth/me", {
    headers: { Authorization: `Bearer ${refresh.body.accessToken}` },
  });
  assert.equal(me.status, 200, `me 200, got ${me.status}`);
  assert.equal((me.body as any).email, "admin@signova.test");

  // --- 5. Cross-organization isolation ---
  console.log("\n[5] Cross-organization reads/mutations");
  const aToken = await createAdmin("org-a", "admina@signova.test");
  const bToken = await createAdmin("org-b", "adminb@signova.test");
  const cross = await j("/api/admin/overview", {
    headers: { Authorization: `Bearer ${bToken}` },
  });
  assert.equal(cross.status, 404, `404 expected for org-b token, got ${cross.status}`);

  // --- 6. Overview metrics ---
  console.log("\n[6] Overview metrics");
  const ov = await j("/api/admin/overview", {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert.equal(ov.status, 200, `overview 200, got ${ov.status}`);
  assert.ok(ov.body.staffTotal >= 0, "staffTotal should be non-negative");
  assert.ok(ov.body.staffActive >= 0, "staffActive should be non-negative");

  // --- 7. Organization settings ---
  console.log("\n[7] Organization settings");
  const set = await j("/api/admin/organization/settings", {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert.equal(set.status, 200, `settings GET 200, got ${set.status}`);
  const upd = await j("/api/admin/organization/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ serviceName: "Updated Desk" }),
  });
  assert.equal(upd.status, 200, `settings PUT 200, got ${upd.status}`);
  assert.equal((upd.body as any).organization?.serviceName, "Updated Desk");

  // --- 8. Staff creation + gmail policy ---
  console.log("\n[8] Staff creation + gmail policy");
  const gmailBad = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ name: "Bad", email: "bad@other.com", role: "STAFF", orgId: "org-a" }),
  });
  assert.equal(gmailBad.status, 400, `gmail policy 400, got ${gmailBad.status}`);

  const good = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ name: "Good", email: "good@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  assert.equal(good.status, 201, `staff create 201, got ${good.status}`);
  assert.equal((good.body as any).isActive, false, "pending");
  assert.equal((good.body as any).role, "STAFF");

  // --- 9. Approval + deactivation + role escalation ---
  console.log("\n[9] Approval + deactivation + role escalation");
  const created = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ name: "Target", email: "tgt@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  assert.equal(created.status, 201, "create target staff");
  const staffId = (created.body as any)._id;

  // Non-admin should not be able to approve.
  const badApprove = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ active: true }),
  });
  assert.equal(badApprove.status, 403, `non-admin approve 403, got ${badApprove.status}`);

  // Admin activates the pending staff account.
  const goodApprove = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ active: true }),
  });
  assert.equal(goodApprove.status, 200, `admin approve 200, got ${goodApprove.status}`);

  // Admin cannot deactivate their own account.
  const selfDeact = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ active: false }),
  });
  assert.equal(selfDeact.status, 403, `self-deactivate 403, got ${selfDeact.status}`);

  // Role escalation should be prevented.
  const escalate = await j(`/api/admin/staff/${staffId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  assert.equal(escalate.status, 403, `role escalation 403, got ${escalate.status}`);

  // --- 10. Tellers ---
  console.log("\n[10] Tellers");
  const tellerCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ name: "Desk1", serviceDesk: "1", counterNumber: "1" }),
  });
  assert.equal(tellerCreate.status, 201, `teller create 201, got ${tellerCreate.status}`);
  const tellerId = (tellerCreate.body as any).teller?._id;

  const status = await j(`/api/admin/tellers/${tellerId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ status: "BUSY" }),
  });
  assert.equal(status.status, 200, `set status 200, got ${status.status}`);

  const assign = await j(`/api/admin/tellers/${tellerId}/assign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ staffUserId: "000000000000000000000001" }),
  });
  assert.equal(assign.status, 404, `assign unresolvable staff 404, got ${assign.status}`);

  // --- 11. Active-session protection ---
  console.log("\n[11] Active-session protection");
  const busyCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ name: "DeskBusy", serviceDesk: "2", counterNumber: "2" }),
  });
  assert.equal(busyCreate.status, 201, "create busy teller");
  const busyId = (busyCreate.body as any).teller?._id;

  await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ status: "BUSY" }),
  });
  const free = await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${aToken}` },
    body: JSON.stringify({ status: "FREE" }),
  });
  assert.equal(free.status, 400, `free busy teller 400, got ${free.status}`);

  // --- 12. Sessions ---
  console.log("\n[12] Sessions");
  const sess = await j("/api/admin/sessions", {
    headers: { Authorization: `Bearer ${aToken}` },
  });
  assert.equal(sess.status, 200, `sessions list 200, got ${sess.status}`);
  assert.ok(Array.isArray((sess.body as any).items), "items should be an array");

  // --- 13. Audit logs ---
  console.log("\n[13] Audit logs");
  const audit = await j("/api/admin/audit-logs", {
    headers: { Authorization: `Bearer ${aToken}` },
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
  const { startTwoFactorEnrollment, activateTwoFactorEnrollment } = await import("../src/services/authService.js");
  const enroll = await startTwoFactorEnrollment(login.body.challengeToken);
  assert.ok(enroll.body.secret, "enroll should return a secret");
  const { authenticator } = await import("otplib");
  const code = authenticator.generate(enroll.body.secret);
  const activated = await activateTwoFactorEnrollment(login.body.challengeToken, code, {} as any);
  assert.ok(activated.body.accessToken, "activate should issue an access token");
  assert.ok(activated.body.refreshToken, "activate should issue a refresh token");

  const refresh = await j("/api/admin/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: activated.body.refreshToken }),
  });
  assert.equal(refresh.status, 200, `refresh 200, got ${refresh.status}`);
  assert.ok(refresh.body.accessToken, "refresh should issue a new access token");

  const me2 = await j("/api/admin/auth/me", {
    headers: { Authorization: `Bearer ${refresh.body.accessToken}` },
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
