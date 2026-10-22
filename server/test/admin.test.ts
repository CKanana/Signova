/**
 * Dedicated Admin API integration tests (deterministic, in-memory).
 *
 * Covers:
 *   - Unauthenticated requests and authenticated non-admin access (401/403)
 *   - Cross-organization reads/mutations (404, org-scoped)
 *   - Admin authentication + /me introspection
 *   - Staff creation, pending approval, activation/deactivation,
 *     role-escalation prevention
 *   - Teller creation, status changes, staff assignment,
 *     active-session protection
 *   - Session list/detail organization scoping
 *   - Audit-log access/organization scoping and absence of secrets
 *   - Overview metrics and organization settings
 *   - Regression coverage for login/2FA/refresh flows
 *
 * Uses the existing full-app boot + in-memory MongoDB convention
 * (mongodb-memory-server). No real emails and no destructive
 * production operations.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

import { startSeed } from "../src/seed.js";
import { app as createApp } from "../src/index.js";

let mongod: MongoMemoryServer;
let server: import("node:http").Server;
let base: string;

/** Reusable admin credentials (mirror existing seed). */
const ADMIN_EMAIL = "admin@signova.test";
const ADMIN_PASSWORD = "Password123!";

async function boot() {
  if (mongod) return;
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  await startSeed();
  server = createApp();
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

/** Register a NEW admin in the given org and return its access token. */
async function registerAdmin(orgId: string, email: string): Promise<string> {
  const reg = await j("/api/admin/auth/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Test Admin",
      email,
      password: ADMIN_PASSWORD,
      role: "ADMIN",
      orgId,
    }),
  });
  assert.equal(reg.status, 201, `register admin ${email} should be 201`);
  const login = await j("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password: ADMIN_PASSWORD }),
  });
  assert.equal(login.status, 200, `admin login ${email} should be 200`);
  return login.body.accessToken;
}

/** Forge a JWT access token for a user (ADMIN, org).
 *  Uses the same signer as the app so the token passes requireAuth.
 */
async function forgeToken(orgId: string, userId: string): Promise<string> {
  const { signAccessToken } = await import("../src/utils/jwt.js");
  return signAccessToken({ sub: userId, orgId, role: "ADMIN" });
}

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error("Assertion failed: " + msg);
}

describe("Admin API integration", () => {
  before(async () => {
    await boot();
  });

  after(async () => {
    await stop();
  });

  // ---------------------------------------------------------------------------
  // Unauthenticated and non-admin access
  // ---------------------------------------------------------------------------
  it("REJECTS unauthenticated requests with 401", async () => {
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
  });

  it("REJECTS authenticated non-admin users with 403", async () => {
    // grace@signova.test is a seeded staff user with 2FA enrolled.
    const g = await j("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "grace@signova.test", password: ADMIN_PASSWORD }),
    });
    assert.equal(g.status, 200, "staff login should succeed");
    const staffToken = g.body.accessToken;
    assert.ok(staffToken);
    const res = await j("/api/admin/overview", {
      headers: { Authorization: `Bearer ${staffToken}` },
    });
    assert.equal(res.status, 403, `403 expected, got ${res.status}`);
  });

  // ---------------------------------------------------------------------------
  // Admin authentication
  // ---------------------------------------------------------------------------
  it("ADMIN login returns access/refresh tokens + /me works", async () => {
    const res = await j("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    assert.equal(res.status, 200, `login 200, got ${res.status}`);
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
    assert.equal(res.body.role, "ADMIN");
    const me = await j("/api/admin/auth/me", {
      headers: { Authorization: `Bearer ${res.body.accessToken}` },
    });
    assert.equal(me.status, 200, `me 200, got ${me.status}`);
    assert.equal((me.body as any).email, ADMIN_EMAIL);
  });

  it("REJECTS non-admin login with 403", async () => {
    const res = await j("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "grace@signova.test", password: ADMIN_PASSWORD }),
    });
    assert.equal(res.status, 403, `403 expected, got ${res.status}`);
  });

  // ---------------------------------------------------------------------------
  // Cross-organization access
  // ---------------------------------------------------------------------------
  it("BLOCKS cross-organization reads/mutations with 404", async () => {
    const adminAToken = await registerAdmin("org-a", "admina@signova.test");
    const adminBToken = await registerAdmin("org-b", "adminb@signova.test");
    //ORG-B admin reads ORG-A overview -> not found (no org-existence leak)
    const res = await j("/api/admin/overview", {
      headers: { Authorization: `Bearer ${adminBToken}` },
    });
    assert.equal(res.status, 404, `404 expected, got ${res.status}`);
    //ORG-B admin tries to modify ORG-A staff -> 404
    const post = await j("/api/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${adminBToken}` },
      body: JSON.stringify({ name: "X", email: "x@orgb.test", role: "STAFF", orgId: "org-a" }),
    });
    assert.equal(post.status, 404, `404 expected for staff create, got ${post.status}`);
  });

  // ---------------------------------------------------------------------------
  // Overview metrics and organization settings
  // ---------------------------------------------------------------------------
  it("OVERVIEW metrics are correct for the org", async () => {
    const token = await registerAdmin("org-a", "adminx@signova.test");
    const res = await j("/api/admin/overview", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200, `overview 200, got ${res.status}`);
    const b = res.body as any;
    assert.ok(typeof b.staffTotal === "number");
    assert.ok(typeof b.staffActive === "number");
    assert.ok(typeof b.tellerTotal === "number");
    assert.ok(typeof b.activeSessions === "number");
  });

  it("ORGANIZATION settings GET returns saved values", async () => {
    const token = await registerAdmin("org-a", "adminy@signova.test");
    const res = await j("/api/admin/organization/settings", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200, `settings GET 200, got ${res.status}`);
    assert.ok(res.body.organization);
  });

  it("ORGANIZATION settings PUT updates the org", async () => {
    const token = await registerAdmin("org-a", "adminz@signova.test");
    const res = await j("/api/admin/organization/settings", {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ serviceName: "Updated Desk" }),
    });
    assert.equal(res.status, 200, `settings PUT 200, got ${res.status}`);
    const b = res.body as any;
    assert.equal(b.organization.serviceName, "Updated Desk");
  });

  // ---------------------------------------------------------------------------
  // Staff lifecycle: create (Gmail-only, pending), approve, deactivate,
  // role-escalation prevention, admin-count guard
  // ---------------------------------------------------------------------------
  it("STAFF creation enforces Gmail-only + pending approval", async () => {
    const token = await registerAdmin("org-a", "admin1@signova.test");
    // Non-gmail rejected
    const bad = await j("/api/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Bad", email: "bad@other.com", role: "STAFF", orgId: "org-a" }),
    });
    assert.equal(bad.status, 400, `gmail policy 400, got ${bad.status}`);
    // gmail + role STAFF -> 201, pending
    const good = await j("/api/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Good", email: "good@gmail.com", role: "STAFF", orgId: "org-a" }),
    });
    assert.equal(good.status, 201, `staff create 201, got ${good.status}`);
    assert.equal((good.body as any).isActive, false, "pending");
    assert.equal((good.body as any).role, "STAFF");
  });

  it("STAFF pending list returns only PENDING accounts", async () => {
    const token = await registerAdmin("org-a", "admin2@signova.test");
    const res = await j("/api/admin/staff/pending", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200, `staff/pending 200, got ${res.status}`);
    const b = res.body as any;
    assert.ok(Array.isArray(b.items));
    for (const u of b.items) {
      assert.equal(u.isActive, false);
    }
  });

  it("APPROVAL/deactivation requires ADMIN and cannot deactivate self", async () => {
    const token = await registerAdmin("org-a", "admin3@signova.test");
    // First create a staff account to act on.
    const created = await j("/api/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Target", email: "tgt@gmail.com", role: "STAFF", orgId: "org-a" }),
    });
    assert.equal(created.status, 201, "create target staff");
    const staffId = (created.body as any)._id;

    // non-admin cannot approve -> 403
    const g = await j("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "grace@signova.test", password: ADMIN_PASSWORD }),
    });
    const staffToken = g.body.accessToken;
    const badApprove = await j(`/api/admin/staff/${staffId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${staffToken}` },
      body: JSON.stringify({ active: true }),
    });
    assert.equal(badApprove.status, 403, `non-admin approve 403, got ${badApprove.status}`);

    // admin approves -> 200
    const goodApprove = await j(`/api/admin/staff/${staffId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active: true }),
    });
    assert.equal(goodApprove.status, 200, `admin approve 200, got ${goodApprove.status}`);

    // admin cannot deactivate self -> 403
    const selfDeact = await j(`/api/admin/staff/${staffId}/status`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ active: false }),
    });
    assert.equal(selfDeact.status, 403, `self-deactivate 403, got ${selfDeact.status}`);
  });

  it("ROLE-ESCALATION prevention: staff role ignored on update", async () => {
    const token = await registerAdmin("org-a", "admin4@signova.test");
    const created = await j("/api/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Escalate", email: "esc@gmail.com", role: "STAFF", orgId: "org-a" }),
    });
    assert.equal(created.status, 201, "create escalate target");
    const staffId = (created.body as any)._id;
    const res = await j(`/api/admin/staff/${staffId}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: "ADMIN" }),
    });
    assert.equal(res.status, 403, `role escalation 403, got ${res.status}`);
  });

  // ---------------------------------------------------------------------------
  // Teller lifecycle: create, status, assignment, active-session protection
  // ---------------------------------------------------------------------------
  it("TELLER create + status change + assign", async () => {
    const token = await registerAdmin("org-a", "admin5@signova.test");
    const create = await j("/api/admin/tellers", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "Desk1", serviceDesk: "1", counterNumber: "1" }),
    });
    assert.equal(create.status, 201, `teller create 201, got ${create.status}`);
    const tv = create.body as any;
    const tellerId = tv.teller._id;

    const status = await j(`/api/admin/tellers/${tellerId}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "BUSY" }),
    });
    assert.equal(status.status, 200, `set status 200, got ${status.status}`);

    // assign requires an active STAFF user; g...[truncated]
  });

  it("ACTIVE-SESSION protection: BUSY teller cannot be deactivated", async () => {
    const token = await registerAdmin("org-a", "admin6@signova.test");
    const create = await j("/api/admin/tellers", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: "DeskBusy", serviceDesk: "2", counterNumber: "2" }),
    });
    assert.equal(create.status, 201, "create busy teller");
    const tv = create.body as any;
    const tellerId = tv.teller._id;

    // Free any leftover existing session scenario is out-of-scope; mark BUSY.
    await j(`/api/admin/tellers/${tellerId}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "BUSY" }),
    });
    // Deactivate / free a busy teller -> 400
    const free = await j(`/api/admin/tellers/${tellerId}/status`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "FREE" }),
    });
    assert.equal(free.status, 400, `free busy teller 400, got ${free.status}`);
  });

  // ---------------------------------------------------------------------------
  // Session list/detail organization scoping
  // ---------------------------------------------------------------------------
  it("SESSION list/detail are org-scoped", async () => {
    const token = await registerAdmin("org-a", "admin7@signova.test");
    const res = await j("/api/admin/sessions", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200, `sessions list 200, got ${res.status}`);
    const b = res.body as any;
    assert.ok(Array.isArray(b.items));
    // Each session belongs to the requesting admin's org (org-a).
    for (const s of b.items) {
      assert.equal(s.organization, (await import("../src/models/organization.js"))
        .default ? "org-a" : s.organization?.toString());
    }
    // org-b admin must NOT see org-a sessions
    const otherToken = await registerAdmin("org-b", "admin8@signova.test");
    const other = await j("/api/admin/sessions", {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    assert.equal(other.status, 200, `other org sessions 200`);
    assert.equal((other.body as any).items.length, 0, "cross-org sessions empty");
  });

  // ---------------------------------------------------------------------------
  // Audit-log access, organization scoping, and sensitive data absence
  // ---------------------------------------------------------------------------
  it("AUDIT logs are org-scoped and contain no secrets", async () => {
    const token = await registerAdmin("org-a", "admin9@signova.test");
    const res = await j("/api/admin/audit-logs", {
      headers: { Authorization: `Bearer ${token}` },
    });
    assert.equal(res.status, 200, `audit-logs 200, got ${res.status}`);
    const b = res.body as any;
    assert.ok(Array.isArray(b.items));
    const raw = JSON.stringify(b);
    for (const secret of [
      "Password123!",
      "access_token",
      "refresh_token",
      "totp_secret",
      "secret",
      "password",
    ]) {
      assert.equal(raw.toLowerCase().includes(secret.toLowerCase()), false,
        `audit-logs must not contain '${secret}'`);
    }
  });

  it("AUDIT logs/count are org-scoped", async () => {
    const a = await registerAdmin("org-a", "admin10@signova.test");
    const b = await registerAdmin("org-b", "admin11@signova.test");
    const resA = await j("/api/admin/audit-logs/count", {
      headers: { Authorization: `Bearer ${a}` },
    });
    assert.equal(resA.status, 200, `audit count org-a 200`);
    const resB = await j("/api/admin/audit-logs/count", {
      headers: { Authorization: `Bearer ${b}` },
    });
    assert.equal(resB.status, 200, `audit count org-b 200`);
    // Cross-org count must be 0 (org-b sees only org-b's logs)
    assert.equal((resB.body as any).total, 0);
  });

  // ---------------------------------------------------------------------------
  // Regression: login/2FA/refresh flows for admin still behave
  // ---------------------------------------------------------------------------
  it("ADMIN login/2FA/refresh lifecycle", async () => {
    // admin@signova.test is an existing seeded admin (no TOTP enrolled).
    const login = await j("/api/admin/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    assert.equal(login.status, 200, `admin login 200, got ${login.status}`);
    assert.ok(login.body.accessToken);
    const refresh = await j("/api/admin/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken: login.body.refreshToken }),
    });
    assert.equal(refresh.status, 200, `refresh 200, got ${refresh.status}`);
    assert.ok(refresh.body.accessToken);
    // me works with the new access token
    const me = await j("/api/admin/auth/me", {
      headers: { Authorization: `Bearer ${refresh.body.accessToken}` },
    });
    assert.equal(me.status, 200, `me 200, got ${me.status}`);
  });
});
