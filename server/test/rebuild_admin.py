import sys
from pathlib import Path

p = Path("server/test/admin.test.ts")

s = r'''/**
 * Dedicated Admin API integration tests (deterministic, in-memory).
 *
 * Run: node --import tsx --test server/test/admin.test.ts
 * Uses the same one-shot server + MongoDB harness as
 * server/test/bootstrap.test.ts: a single main() boots the real Express app
 * + in-memory DB once, runs all assertions, then tears down.
 */

import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { User } from "../src/models/user.js";
import { Organization } from "../src/models/organization.js";
import { Teller } from "../src/models/teller.js";
import { Invitation } from "../src/models/invitation.js";
import { SetupToken } from "../src/models/setupToken.js";
import { connectDatabase, disconnectDatabase } from "../src/config/db.js";
import { createTestApp } from "../src/test/app.js";

let passed = 0;
let failed = 0;
const failures: string[] = [];
let mongod: any;
let base: string;
let serverInstance: any;

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

async function connect() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  await connectDatabase();
  await (await import("../src/seed/seed.js")).seed();
}

async function disconnect() {
  if (mongod) {
    await disconnectDatabase();
    await mongod.stop();
  }
}

async function main() {
  console.log("Starting in-memory MongoDB...");
  await connect();

  const app = createTestApp();
  serverInstance = (await import("node:http")).createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, "127.0.0.1", () => resolve()));
  const port = (serverInstance.address() as { port: number }).port;
  base = `http://127.0.0.1:${port}`;

  const j = async (path: string, opts: RequestInit = {}) => {
    const mergedHeaders = {
      "content-type": "application/json",
      ...((opts as any).headers || {}),
    };
    const res = await fetch(`${base}${path}`, { ...opts, headers: mergedHeaders });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };

  // ---- 1. Unauthenticated requests rejected ----
  console.log("\n[1] Unauthenticated requests");
  for (const path of ["/overview", "/organization/settings", "/staff", "/staff/pending", "/tellers", "/sessions", "/audit-logs"]) {
    const res = await j(`/api/admin${path}`);
    check(`401 for ${path}`, res.status === 401, `got ${res.status}`);
  }

  // ---- 2. Non-admin rejected ----
  console.log("\n[2] Non-admin access");
  const g = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "grace@signova.test", password: "Password123!" }),
  });
  check("grace can log in", g.status === 200 && !!g.body.challengeToken, JSON.stringify(g.body));
  const staffToken = g.body.challengeToken;
  const bad = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${staffToken}` } });
  check("staff token blocked with 403", bad.status === 403, `got ${bad.status}`);

  // ---- 3. Seeded admin login ----
  console.log("\n[3] Seeded admin login flow");
  const adminLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  check("admin login returns challenge token", adminLogin.status === 200 && !!adminLogin.body.challengeToken, JSON.stringify(adminLogin.body));

  // ---- 4. Cross-org isolation ----
  console.log("\n[4] Cross-organization isolation");
  const adminAToken = await createAdmin("admina@signova.test");
  const adminBToken = await createAdmin("adminb@signova.test");
  await j("/api/admin/overview", { headers: { Authorization: `Bearer ${adminBToken}` } })
    .then(r => check("cross-org overview 404", r.status === 404, `got ${r.status}`))
    .catch(() => {});
  const else1 = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminBToken}` },
    body: JSON.stringify({ name: "X", email: "x@orgb.test", role: "STAFF", orgId: "org-a" }),
  });
  check("cross-org staff create 404", else1.status === 404, `got ${else1.status}`);

  // ---- 5. Overview metrics ----
  console.log("\n[5] Overview metrics");
  const ov = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("overview 200", ov.status === 200, `got ${ov.status}`);
  const b = ov.body || {};
  check("overview has staffTotal", typeof (b as any).staffTotal === "number");
  check("overview has staffActive", typeof (b as any).staffActive === "number");
  check("overview has tellerTotal", typeof (b as any).tellerTotal === "number");
  check("overview has activeSessions", typeof (b as any).activeSessions === "number");

  // ---- 6. Organization settings ----
  console.log("\n[6] Organization settings");
  const set = await j("/api/admin/organization/settings", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("settings GET 200", set.status === 200, `got ${set.status}`);
  const upd = await j("/api/admin/organization/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ serviceName: "Updated Desk" }),
  });
  check("settings PUT 200 + saved", upd.status === 200 && (upd.body || {}).organization?.serviceName === "Updated Desk", JSON.stringify(upd.body));

  // ---- 7. Staff creation + Gmail policy ----
  console.log("\n[7] Staff creation + Gmail policy");
  const bad = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: "Bad", email: "bad@other.com", role: "STAFF", orgId: "org-a" }),
  });
  check("gmail policy 400", bad.status === 400, `got ${bad.status}`);
  const good = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: "Good", email: "good@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  check("staff create 201 + pending + STAFF", good.status === 201 && (good.body || {}).isActive === false && (good.body || {}).role === "STAFF", JSON.stringify(good.body));

  // ---- 8. Pending list ----
  console.log("\n[8] Staff pending list");
  const pend = await j("/api/admin/staff/pending", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("staff/pending 200", pend.status === 200, `got ${pend.status}`);
  const pb = pend.body || {};
  check("pending is array", Array.isArray(pb.items));
  for (const u of pb.items as any[]) {
    check(`item inactive: ${u.email}`, u.isActive === false);
  }

  // ---- 9. Approval / deactivation / role escalation ----
  console.log("\n[9] Approval + deactivation + role escalation");
  const created = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: "Target", email: "tgt@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  check("create target staff 201", created.status === 201, `got ${created.status}`);
  const staffId = (created.body || {})._id;

  const badApprove = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ active: true }),
  });
  check("non-admin approve 403", badApprove.status === 403, `got ${badApprove.status}`);

  const goodApprove = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ active: true }),
  });
  check("admin approve 200", goodApprove.status === 200, `got ${goodApprove.status}`);

  const selfDeact = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ active: false }),
  });
  check("self-deactivate 403", selfDeact.status === 403, `got ${selfDeact.status}`);

  const escalate = await j(`/api/admin/staff/${staffId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  check("role escalation 403", escalate.status === 403, `got ${escalate.status}`);

  // ---- 10. Tellers ----
  console.log("\n[10] Tellers");
  const tellerCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: "Desk1", serviceDesk: "1", counterNumber: "1" }),
  });
  check("teller create 201", tellerCreate.status === 201, `got ${tellerCreate.status}`);
  const tellerId = (tellerCreate.body || {}).teller?._id;

  const status = await j(`/api/admin/tellers/${tellerId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ status: "BUSY" }),
  });
  check("set teller busy 200", status.status === 200, `got ${status.status}`);

  const assign = await j(`/api/admin/tellers/${tellerId}/assign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ staffUserId: "000000000000000000000001" }),
  });
  check("assign unresolvable staff 404", assign.status === 404, `got ${assign.status}`);

  // ---- 11. Busy-teller cannot be freed ----
  console.log("\n[11] Busy-teller protection");
  const busyCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: "DeskBusy", serviceDesk: "2", counterNumber: "2" }),
  });
  check("create busy teller 201", busyCreate.status === 201, `got ${busyCreate.status}`);
  const busyId = (busyCreate.body || {}).teller?._id;

  await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ status: "BUSY" }),
  });
  const free = await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ status: "FREE" }),
  });
  check("free busy teller 400", free.status === 400, `got ${free.status}`);

  // ---- 12. Sessions / audit scoping ----
  console.log("\n[12] Sessions + audit scoping");
  const sess = await j("/api/admin/sessions", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("sessions list 200", sess.status === 200, `got ${sess.status}`);
  const sb = sess.body || {};
  check("sessions items array", Array.isArray(sb.items));

  const other = await createAdmin("admin8@signova.test");
  const otherSess = await j("/api/admin/sessions", { headers: { Authorization: `Bearer ${other}` } });
  check("other org sessions empty", (otherSess.body || {}).items.length === 0, JSON.stringify(otherSess.body));

  const audit = await j("/api/admin/audit-logs", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("audit-logs 200", audit.status === 200, `got ${audit.status}`);
  const ab = audit.body || {};
  check("audit items array", Array.isArray(ab.items));

  const adminB2 = await createAdmin("admin9@signova.test");
  const auditB = await j("/api/admin/audit-logs/count", { headers: { Authorization: `Bearer ${adminB2}` } });
  check("cross-org audit count 0", (auditB.body || {}).total === 0, JSON.stringify(auditB.body));

  // ---- 13. Admin password reset lifecycle ----
  console.log("\n[13] Admin login/2FA/refresh lifecycle");
  const login = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  check("admin login 200", login.status === 200 && !!login.body.challengeToken, JSON.stringify(login.body));
  const { startTwoFactorEnrollment, activateTwoFactorEnrollment } = await import("../src/services/authService.js");
  const enroll = await startTwoFactorEnrollment(login.body.challengeToken);
  check("enroll start 200", enroll.status === 200 && !!enroll.body.secret);
  const { authenticator } = await import("otplib");
  const code = authenticator.generate(enroll.body.secret!);
  const activated = await activateTwoFactorEnrollment(login.body.challengeToken, code, {} as any);
  check("activate 200 + tokens", activated.status === 200 && !!activated.body.accessToken && !!activated.body.refreshToken, JSON.stringify(activated.body));

  const refresh = await j("/api/admin/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: activated.body.refreshToken }),
  });
  check("refresh 200 + new token", refresh.status === 200 && !!refresh.body.accessToken, JSON.stringify(refresh.body));
  const me = await j("/api/admin/auth/me", { headers: { Authorization: `Bearer ${refresh.body.accessToken}` } });
  check("me 200 + email", me.status === 200 && (me.body || {}).email === "admin@signova.test", JSON.stringify(me.body));

  // ---- 14. Seed preservation ----
  console.log("\n[14] Seed preservation");
  await (await import("../src/seed/seed.js")).seed();
  const adminBefore = await User.findOne({ email: "admin@signova.test" });
  check("admin preserved", !!adminBefore && adminBefore.isActive === true);
  const graceBefore = await User.findOne({ email: "grace@signova.test" });
  check("seeded staff preserved", !!graceBefore && graceBefore.role === "STAFF");
  const tellersBefore = await Teller.find({ organization: (await Organization.findOne({ shortName: "KNH" }))!._id });
  check("tellers preserved", tellersBefore.length === 3, `got ${tellersBefore.length}`);

  // ---- Tear down ----
  if (serverInstance) {
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
    serverInstance = undefined;
  }
  await disconnect();

  console.log("========================================");
  console.log(`RESULTS: ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("Failures:");
    failures.forEach(f => console.log(`  - ${f}`));
  }
  console.log("========================================");
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
'''

p.write_text(s)
print("wrote", p, len(s))
