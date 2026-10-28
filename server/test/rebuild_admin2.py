import re
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

async function main() {
  console.log("Starting in-memory MongoDB...");
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();

  const { connectDatabase } = await import("../src/config/db.js");
  const { seed } = await import("../src/seed/seed.js");
  const { acceptBootstrap, activateBootstrap } = await import("../src/admin/services/bootstrapService.js");
  const { createInvitation } = await import("../src/admin/services/invitationService.js");
  const { setMailTransport } = await import("../src/services/mailService.js");
  const { signAccessToken } = await import("../src/utils/jwt.js");
  const { decryptSecret } = await import("../src/utils/crypto.js");
  const { randomToken, hashToken } = await import("../src/utils/crypto.js");
  const { authenticator } = await import("otplib");
  const { User } = await import("../src/models/user.js");
  const { Organization } = await import("../src/models/organization.js");
  const { SetupToken } = await import("../src/models/setupToken.js");
  const { Teller } = await import("../src/models/teller.js");
  const adminRouter = (await import("../src/admin/index.js")).default;
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

  // Build the real app + HTTP server.
  const app = express();
  app.use(express.json());
  app.use("/api/health", (await import("../src/routes/health.js")).default);
  app.use("/api/auth", (await import("../src/routes/auth.js")).default);
  app.use("/api/organizations", (await import("../src/routes/organizations.js")).default);
  app.use("/api/tellers", (await import("../src/routes/tellers.js")).default);
  app.use("/api/sessions", (await import("../src/routes/sessions.js")).default);
  app.use("/api/sessions/:id/messages", (await import("../src/routes/messages.js")).default);
  app.use("/api/kiosk", (await import("../src/routes/kiosk.js")).default);
  app.use("/api/staff", (await import("../src/routes/staff.js")).default);
  app.use("/api/admin", adminRouter);
  app.use((await import("../src/middleware/error.js")).notFoundHandler);
  app.use((await import("../src/middleware/error.js")).errorHandler);

  serverInstance = createServer(app);
  await new Promise<void>((r) => serverInstance.listen(0, "127.0.0.1", () => r()));
  const port = (serverInstance.address() as { port: number }).port;
  base = `http://127.0.0.1:${port}`;

  const j = async (path: string, opts: RequestInit = {}) => {
    const mergedHeaders = {
      "content-type": "application/json",
      ...(opts.headers || {}),
    };
    const res = await fetch(`${base}${path}`, { ...opts, headers: mergedHeaders });
    const body = await res.json().catch(() => ({}));
    return { status: res.status, body };
  };

  console.log("\n[1] Unauthenticated requests rejected");
  for (const path of ["/overview", "/organization/settings", "/staff", "/staff/pending", "/tellers", "/sessions", "/audit-logs"]) {
    const res = await j(`/api/admin${path}`);
    check(`401 for ${path}`, res.status === 401, `got ${res.status}`);
  }

  console.log("\n[2] Non-admin blocked");
  const g = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "grace@signova.test", password: "Password123!" }),
  });
  check("grace can log in", g.status === 200 && g.body.challengeToken, JSON.stringify(g.body));
  const bad = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${g.body.challengeToken}` } });
  check("staff token blocked with 403", bad.status === 403, `got ${bad.status}`);

  console.log("\n[3] Seeded admin login flow");
  const adminLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  check("admin login returns challenge token", adminLogin.status === 200 && adminLogin.body.challengeToken, JSON.stringify(adminLogin.body));

  async function createAdmin(email: string): Promise<string> {
    // First, the seeded admin obtains an access token via the 2FA enrollment
    // flow. The seed admin has two-factor disabled, so login returns the
    // mfa_enroll_required challenge token.
    const seedLogin = await j("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
    });
    check("seed admin login 200", seedLogin.status === 200 && seedLogin.body.challengeToken, JSON.stringify(seedLogin.body));
    const seedToken = seedLogin.body.challengeToken;

    const { startTwoFactorEnrollment, activateTwoFactorEnrollment } = await import("../src/services/authService.js");
    const enroll = await startTwoFactorEnrollment(seedToken);
    check("enroll start 200", enroll.status === 200 && enroll.body.secret, "enroll failed");
    const code = authenticator.generate(enroll.body.secret!);
    const activated = await activateTwoFactorEnrollment(seedToken, code, {} as any);
    check("seed admin activated", activated.status === 200 && activated.body.accessToken, JSON.stringify(activated.body));
    const seedAdminToken = activated.body.accessToken;

    // Now use the seed admin (a SYSTEM admin) to create the new admin via
    // the admin-portal flow. Public registration is disabled, so we do not
    // call /api/admin/auth/register; instead we exercise the real
    // POST /api/admin/staff endpoint.
    const res = await j("/api/admin/staff", {
      method: "POST",
      headers: { Authorization: `Bearer ${seedAdminToken}` },
      body: JSON.stringify({ name: "Created Admin", email, role: "ADMIN", orgId: "org-a" }),
    });
    check(`create admin ${email} 201`, res.status === 201, `got ${res.status}`);
    return (res.body as any)?.staff?._id ?? "";
  }

  console.log("\n[4] Cross-organization isolation");
  const adminAToken = await createAdmin("admina@signova.test");
  const adminBToken = await createAdmin("adminb@signova.test");
  const cross = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${adminBToken}` } });
  check("cross-org overview 404", cross.status === 404, `got ${cross.status}`);
  const else1 = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminBToken}` },
    body: JSON.stringify({ name: "X", email: "x@orgb.test", role: "STAFF", orgId: "org-a" }),
  });
  check("cross-org staff create 404", else1.status === 404, `got ${else1.status}`);

  console.log("\n[5] Overview metrics");
  const ov = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("overview 200", ov.status === 200, `got ${ov.status}`);
  const b = ov.body || {};
  check("overview has staffTotal", typeof (b as any).staffTotal === "number");
  check("overview has staffActive", typeof (b as any).staffActive === "number");
  check("overview has tellerTotal", typeof (b as any).tellerTotal === "number");
  check("overview has activeSessions", typeof (b as any).activeSessions === "number");

  console.log("\n[6] Organization settings");
  const set = await j("/api/admin/organization/settings", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("settings GET 200", set.status === 200, `got ${set.status}`);
  const upd = await j("/api/admin/organization/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ serviceName: "Updated Desk" }),
  });
  check("settings PUT 200 + saved", upd.status === 200 && (upd.body || {}).organization?.serviceName === "Updated Desk", JSON.stringify(upd.body));

  console.log("\n[7] Staff creation + Gmail policy");
  const gmailBad = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: "Bad", email: "bad@other.com", role: "STAFF", orgId: "org-a" }),
  });
  check("gmail policy 400", gmailBad.status === 400, `got ${gmailBad.status}`);
  const good = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminAToken}` },
    body: JSON.stringify({ name: "Good", email: "good@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  check("staff create 201 + pending + STAFF", good.status === 201 && (good.body || {}).isActive === false && (good.body || {}).role === "STAFF", JSON.stringify(good.body));

  console.log("\n[8] Staff pending list");
  const pend = await j("/api/admin/staff/pending", { headers: { Authorization: `Bearer ${adminAToken}` } });
  check("staff/pending 200", pend.status === 200, `got ${pend.status}`);
  const pb = pend.body || {};
  check("pending is array", Array.isArray(pb.items));
  for (const u of pb.items as any[]) {
    check(`item inactive: ${u.email}`, u.isActive === false);
  }

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
    headers: { Authorization: `Bearer ${g.body.challengeToken}` },
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

  console.log("\n[11] Busy-teller cannot be freed");
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

  console.log("\n[13] Admin login/2FA/refresh lifecycle");
  const login = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  check("admin login 200", login.status === 200 && login.body.challengeToken, JSON.stringify(login.body));
  const { startTwoFactorEnrollment, activateTwoFactorEnrollment } = await import("../src/services/authService.js");
  const enroll = await startTwoFactorEnrollment(login.body.challengeToken);
  check("enroll start 200", enroll.status === 200 && !!enroll.body.secret);
  const { authenticator: otel } = await import("otplib");
  const code = otel.generate(enroll.body.secret!);
  const activated = await activateTwoFactorEnrollment(login.body.challengeToken, code, {} as any);
  check("activate 200 + tokens", activated.status === 200 && !!activated.body.accessToken && !!activated.body.refreshToken, JSON.stringify(activated.body));

  const refresh = await j("/api/admin/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: activated.body.refreshToken }),
  });
  check("refresh 200 + new token", refresh.status === 200 && !!refresh.body.accessToken, JSON.stringify(refresh.body));
  const me = await j("/api/admin/auth/me", { headers: { Authorization: `Bearer ${refresh.body.accessToken}` } });
  check("me 200 + email", me.status === 200 && (me.body || {}).email === "admin@signova.test", JSON.stringify(me.body));

  console.log("\n[14] Seed preservation");
  await (await import("../src/seed/seed.js")).seed();
  const adminBefore = await User.findOne({ email: "admin@signova.test" });
  check("admin preserved", !!adminBefore && adminBefore.isActive === true);
  const graceBefore = await User.findOne({ email: "grace@signova.test" });
  check("seeded staff preserved", !!graceBefore && graceBefore.role === "STAFF");
  const tellersBefore = await Teller.find({ organization: (await Organization.findOne({ shortName: "KNH" }))!._id });
  check("tellers preserved", tellersBefore.length === 3, `got ${tellersBefore.length}`);

  if (serverInstance) {
    await new Promise<void>((resolve) => serverInstance.close(() => resolve()));
    serverInstance = undefined;
  }
  await disconnectDatabase();

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
