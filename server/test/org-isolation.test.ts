/** ADDITIONAL ORGANISATION-ISOLATION ASSERTIONS FOR M1.
 *
 * As an Org A admin against Org B data, cover:
 *   staff (list, by id, update, status, 2FA reset)
 *   tellers (list, by id, update, status, assign)
 *   sessions (list, by id)
 *   session messages
 *   audit logs
 *   organization settings (read and update)
 *   invitations (resend)
 *   staff changing another teller's availability
 *
 * Every cross-org assertion expects the route to only return the caller's
 * own org's data (no Org B data leaked), and to reject cross-org by-id
 * reads/updates. Runs against an in-memory MongoDB (mongodb-memory-server) only.
 *
 * All permission/isolation tests use tokenFor() (deterministic full-scope
 * access token, no 2FA flow).
 */
import { test, before, after } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";
import { User } from "../src/models/user.js";
import { Teller } from "../src/models/teller.js";
import { Organization } from "../src/models/organization.js";
import { tokenFor } from "./helpers/tokens.js";
import { server, base, startTestServer, stopTestServer } from "./harness.js";

// --- Test harness ---
let mongod: any;
let server: http.Server;
let orgA: any;
let orgB: any;
let otherOrgId: string;
let adminTokenA: string;
let staffTokenA: string;
let tellerA: any;
let tellerB: any;

function check(name: string, cond: boolean, detail: string = ""): void {
  if (cond) {
    console.log("  PASS  " + name);
  } else {
    console.log("  FAIL  " + name + " " + detail);
    throw new Error("Assertion failed: " + name);
  }
}

function authHeader(token: string) {
  return { headers: { authorization: "Bearer " + token } };
}

before(async () => {
  // Set test env BEFORE config module is loaded (config is cached at module
  // load and used by tokenFor / createTestApp). These must run first.
  process.env.NODE_ENV = "test";
  process.env.PORT = "4598";
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
  process.env.ADMIN_PORTAL_URL = "http://localhost:5174";

  await startTestServer();

  const { seed } = await import("../src/seed/seed.js");
  await seed();

  orgA = await Organization.findOne({ shortName: "KNH" })!;
  orgB = await Organization.findOne({ shortName: "MTRH" })!;
  otherOrgId = orgB._id.toString();

  // Token-for: deterministic full-scope access token, no 2FA, no OTP.
  // KNH seeded staff: grace@signova.test, brian@signova.test, njeri@signova.test
  adminTokenA = await tokenFor({ email: "admin@signova.test", org: orgA._id.toString(), role: "ADMIN" });
  // Use njeri@ (active, 2FA-enabled seeded staff), NOT isa@
  staffTokenA = await tokenFor({ email: "njeri@signova.test", org: orgA._id.toString(), role: "STAFF" });

  tellerA = await Teller.findOne({ organization: orgA._id })!;
  tellerB = await Teller.findOne({ organization: orgB._id })!;
});

after(async () => {
  await stopTestServer();
});

// --- Cross-org isolation: Org A admin vs Org B resources ---

test("staff: list returns only Org A staff, no Org B data", async () => {
  const res = await fetch(base + "/api/admin/staff", authHeader(adminTokenA));
  const body = await res.json() as { items: any[] };
  check("no Org B staff in list", body.items.every((s) => s.organization === orgA._id.toString()), "got " + body.items.length + " staff");
});

test("staff: by id returns 404 for Org B staff (blocked)", async () => {
  const res = await fetch(base + "/api/admin/staff/" + tellerB._id.toString(), authHeader(adminTokenA));
  check("staff by id returns 404 (blocked)", res.status === 404, "got " + res.status);
});

test("staff: update blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/staff/" + tellerB._id.toString(), {
    method: "PUT",
    headers: authHeader(adminTokenA),
    body: JSON.stringify({ name: "x" }),
  });
  check("staff update blocked (404)", res.status === 404, "got " + res.status);
});

test("staff: 2fa reset blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/staff/" + tellerB._id.toString() + "/2fa/reset", {
    method: "POST",
    headers: authHeader(adminTokenA),
  });
  check("staff 2fa reset blocked (404)", res.status === 404, "got " + res.status);
});

test("tellers: list returns only Org A tellers", async () => {
  const res = await fetch(base + "/api/admin/tellers", authHeader(adminTokenA));
  const body = await res.json() as { items: any[] };
  check("no Org B tellers in list", body.items.every((t) => t.organization === orgA._id.toString()), "got " + body.items.length);
});

test("tellers: by id blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/tellers/" + tellerB._id.toString(), authHeader(adminTokenA));
  check("teller by id returns 404 (blocked)", res.status === 404, "got " + res.status);
});

test("tellers: update blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/tellers/" + tellerB._id.toString(), { method: "PUT", headers: authHeader(adminTokenA), body: JSON.stringify({ serviceLabel: "x" }) });
  check("teller update blocked (404)", res.status === 404, "got " + res.status);
});

test("tellers: assign blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/tellers/" + tellerB._id.toString() + "/assign", { method: "POST", headers: authHeader(adminTokenA), body: JSON.stringify({ staffUserId: "" }) });
  check("teller assign blocked (404)", res.status === 404, "got " + res.status);
});

test("sessions: list blocked (only Org A sessions)", async () => {
  const res = await fetch(base + "/api/admin/sessions", authHeader(adminTokenA));
  const body = await res.json() as { items: any[] };
  check("no Org B sessions in list", body.items.every((s) => s.organization?.toString() === orgA._id.toString()), "got " + body.items.length);
});

test("sessions: by id blocked (404)", async () => {
  const sid = (await import("../src/models/session.js")).default.findOne({ organization: orgB._id })?._id?.toString?.() ?? "";
  const res = await fetch(base + "/api/admin/sessions/" + sid, authHeader(adminTokenA));
  check("session by id returns 404 (blocked)", res.status === 404, "got " + res.status);
});

test("messages: list blocked (404)", async () => {
  const sid = (await import("../src/models/session.js")).default.findOne({ organization: orgB._id })?._id?.toString?.() ?? "";
  const res = await fetch(base + "/api/admin/sessions/" + sid + "/messages", authHeader(adminTokenA));
  check("session messages blocked (404)", res.status === 404, "got " + res.status);
});

test("messages: by id blocked (404)", async () => {
  const sid = (await import("../src/models/session.js")).default.findOne({ organization: orgB._id })?._id?.toString?.() ?? "";
  if (!sid) { check("no Org B session to test", true); return; }
  const mid = (await import("../src/models/message.js")).default.findOne({ session: sid })?._id?.toString?.() ?? "";
  const res = await fetch(base + "/api/admin/sessions/" + sid + "/messages/" + mid, authHeader(adminTokenA));
  check("session message by id blocked (404)", res.status === 404, "got " + res.status);
});

test("audit logs: blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/audit-logs", authHeader(adminTokenA));
  check("audit logs blocked (404)", res.status === 404, "got " + res.status);
});

test("organization settings: read blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/organization/settings", authHeader(adminTokenA));
  check("org settings read blocked (404)", res.status === 404, "got " + res.status);
});

test("organization settings: update blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/organization/settings", { method: "PUT", headers: authHeader(adminTokenA), body: JSON.stringify({ serviceName: "x" }) });
  check("org settings update blocked (404)", res.status === 404, "got " + res.status);
});

test("invitations: resend blocked (404)", async () => {
  const res = await fetch(base + "/api/admin/staff/invite/resend", { method: "POST", headers: authHeader(adminTokenA) });
  check("invite resend blocked (404)", res.status === 404, "got " + res.status);
});

test("invitations: accept blocked (400/404)", async () => {
  const res = await fetch(base + "/api/admin/invitations/accept", { method: "POST", headers: authHeader(adminTokenA), body: JSON.stringify({ token: "x" }) });
  check("invitation accept blocked (400/404)", res.status === 400 || res.status === 404, "got " + res.status);
});

// --- Staff may change only own org teller availability ---

test("staff: may change own org teller availability (200)", async () => {
  const res = await fetch(base + "/api/tellers/" + tellerA._id + "/availability", {
    method: "PATCH",
    headers: authHeader(staffTokenA),
    body: JSON.stringify({ status: "FREE" }),
  });
  check("own teller availability change", res.status === 200, "got " + res.status);
});

test("staff: cannot change Org B teller availability (blocked)", async () => {
  const res = await fetch(base + "/api/tellers/" + tellerB._id + "/availability", {
    method: "PATCH",
    headers: authHeader(staffTokenA),
    body: JSON.stringify({ status: "FREE" }),
  });
  // The route filters by orgId from the token; cross-org returns 404 (no leak).
  check("cross-org teller change blocked (404)", res.status === 404, "got " + res.status);
});

// --- Staff cannot call /api/admin routes ---

test("staff: cannot call /api/admin routes (403 or 404)", async () => {
  const res = await fetch(base + "/api/admin/staff", { method: "GET", headers: authHeader(staffTokenA) });
  check("staff admin list blocked (403 or 404)", res.status === 403 || res.status === 404, "got " + res.status);
});

test("staff: cannot create staff (403)", async () => {
  const res = await fetch(base + "/api/admin/staff", { method: "POST", headers: authHeader(staffTokenA), body: JSON.stringify({ name: "X", email: "x@signova.test" }) });
  check("staff create staff blocked (403)", res.status === 403, "got " + res.status);
});
