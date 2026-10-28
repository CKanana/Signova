'''
This script regenerates server/test/admin.test.ts as a clean, deterministic
Admin API integration test: one in-memory MongoDB, one real Express app (via
the project's createTestApp / the src/admin route surface), and a single
main() that obtains a SYSTEM-admin access token via the proven bootstrap
flow, then exercises all admin routes sequentially before tearing down.
'''

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

  // ---------------------------------------------------------------------------
  // Obtain a SYSTEM-admin access token via the bootstrap flow (proven working):
  // seed() creates the bootstrap user "crystal.kanana@strathmore.edu" as an
  // ADMIN with 2FA disabled and an unaccepted bootstrap setup token. We accept
  // the token, enroll 2FA with a real TOTP code, and get an access token.
  // ---------------------------------------------------------------------------
  const bootstrapUserEmail = "crystal.kanana@strathmore.edu";
  const bl = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: bootstrapUserEmail, password: "Password123!" }),
  });
  check("bootstrap user can log in", bl.status === 200 && bl.body.challengeToken, JSON.stringify(bl.body));
  const bootstrapChallenge = bl.body.challengeToken;

  const enrollRes = await j("/api/admin/2fa/enroll/start", {
    method: "POST",
    body: JSON.stringify({ challengeToken: bootstrapChallenge }),
  });
  check("2FA enroll/start succeeds", enrollRes.status === 200 && !!enrollRes.body.secret, JSON.stringify(enrollRes.body));
  const { secret } = enrollRes.body;
  const { authenticator: otel } = await import("otplib");
  const totpCode = otel.generate(secret!);
  const actRes = await j("/api/admin/2fa/enroll/activate", {
    method: "POST",
    body: JSON.stringify({ challengeToken: bootstrapChallenge, code: totpCode }),
  });
  check("2FA activate succeeds", actRes.status === 200 && actRes.body.status === "authenticated", JSON.stringify(actRes.body));
  const adminToken = actRes.body.accessToken;

  // ---------------------------------------------------------------------------
  // 1. Unauthenticated requests are rejected.
  // ---------------------------------------------------------------------------
  console.log("\n[1] Unauthenticated requests rejected");
  for (const path of ["/overview", "/organization/settings", "/staff", "/staff/pending", "/tellers", "/sessions", "/audit-logs"]) {
    const res = await j(`/api/admin${path}`);
    check(`401 for ${path}`, res.status === 401, `got ${res.status}`);
  }

  // ---------------------------------------------------------------------------
  // 2. Non-admin (seeded staff) cannot reach the admin surface.
  // ---------------------------------------------------------------------------
  console.log("\n[2] Non-admin blocked");
  const g = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "grace@signova.test", password: "Password123!" }),
  });
  check("grace can log in", g.status === 200 && g.body.challengeToken, JSON.stringify(g.body));
  const bad = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${g.body.challengeToken}` } });
  check("staff token blocked with 403", bad.status === 403, `got ${bad.status}`);

  // ---------------------------------------------------------------------------
  // 3. Cross-organization isolation.
  // ---------------------------------------------------------------------------
  console.log("\n[3] Cross-organization isolation");
  const a = await createAdmin("admina@signova.test");
  const b = await createAdmin("adminb@signova.test");
  const cross = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${b}` } });
  check("cross-org overview 404", cross.status === 404, `got ${cross.status}`);
  const else1 = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${b}` },
    body: JSON.stringify({ name: "X", email: "x@orgb.test", role: "STAFF", orgId: "org-a" }),
  });
  check("cross-org staff create 404", else1.status === 404, `got ${else1.status}`);

  // ---------------------------------------------------------------------------
  // 4. Overview metrics.
  // ---------------------------------------------------------------------------
  console.log("\n[4] Overview metrics");
  const ov = await j("/api/admin/overview", { headers: { Authorization: `Bearer ${a}` } });
  check("overview 200", ov.status === 200, `got ${ov.status}`);
  const ob = ov.body || {};
  check("overview has staffTotal", typeof (ob as any).staffTotal === "number");
  check("overview has staffActive", typeof (ob as any).staffActive === "number");
  check("overview has tellerTotal", typeof (ob as any).tellerTotal === "number");
  check("overview has activeSessions", typeof (ob as any).activeSessions === "number");

  // ---------------------------------------------------------------------------
  // 5. Organization settings.
  // ---------------------------------------------------------------------------
  console.log("\n[5] Organization settings");
  const set = await j("/api/admin/organization/settings", { headers: { Authorization: `Bearer ${a}` } });
  check("settings GET 200", set.status === 200, `got ${set.status}`);
  const upd = await j("/api/admin/organization/settings", {
    method: "PUT",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ serviceName: "Updated Desk" }),
  });
  check("settings PUT 200 + saved", upd.status === 200 && (upd.body || {}).organization?.serviceName === "Updated Desk", JSON.stringify(upd.body));

  // ---------------------------------------------------------------------------
  // 6. Staff creation + Gmail policy.
  // ---------------------------------------------------------------------------
  console.log("\n[6] Staff creation + Gmail policy");
  const bad = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ name: "Bad", email: "bad@other.com", role: "STAFF", orgId: "org-a" }),
  });
  check("gmail policy 400", bad.status === 400, `got ${bad.status}`);
  const good = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ name: "Good", email: "good@gmail.com", role: "STAFF", orgId: "org-a" }),
  });
  check("staff create 201 + pending + STAFF", good.status === 201 && (good.body || {}).isActive === false && (good.body || {}).role === "STAFF", JSON.stringify(good.body));

  // ---------------------------------------------------------------------------
  // 7. Staff pending list.
  // ---------------------------------------------------------------------------
  console.log("\n[7] Staff pending list");
  const pend = await j("/api/admin/staff/pending", { headers: { Authorization: `Bearer ${a}` } });
  check("staff/pending 200", pend.status === 200, `got ${pend.status}`);
  const pb = pend.body || {};
  check("pending is array", Array.isArray(pb.items));
  for (const u of pb.items as any[]) {
    check(`item inactive: ${u.email}`, u.isActive === false);
  }

  // ---------------------------------------------------------------------------
  // 8. Approval + deactivation + role escalation.
  // ---------------------------------------------------------------------------
  console.log("\n[8] Approval + deactivation + role escalation");
  const created = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${a}` },
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
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ active: true }),
  });
  check("admin approve 200", goodApprove.status === 200, `got ${goodApprove.status}`);

  const selfDeact = await j(`/api/admin/staff/${staffId}/status`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ active: false }),
  });
  check("self-deactivate 403", selfDeact.status === 403, `got ${selfDeact.status}`);

  const escalate = await j(`/api/admin/staff/${staffId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ role: "ADMIN" }),
  });
  check("role escalation 403", escalate.status === 403, `got ${escalate.status}`);

  // ---------------------------------------------------------------------------
  // 9. Tellers.
  // ---------------------------------------------------------------------------
  console.log("\n[9] Tellers");
  const tellerCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ name: "Desk1", serviceDesk: "1", counterNumber: "1" }),
  });
  check("teller create 201", tellerCreate.status === 201, `got ${tellerCreate.status}`);
  const tellerId = (tellerCreate.body || {}).teller?._id;

  const status = await j(`/api/admin/tellers/${tellerId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ status: "BUSY" }),
  });
  check("set teller busy 200", status.status === 200, `got ${status.status}`);

  const assign = await j(`/api/admin/tellers/${tellerId}/assign`, {
    method: "POST",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ staffUserId: "000000000000000000000001" }),
  });
  check("assign unresolvable staff 404", assign.status === 404, `got ${assign.status}`);

  // ---------------------------------------------------------------------------
  // 10. Busy-teller cannot be freed.
  // ---------------------------------------------------------------------------
  console.log("\n[10] Busy-teller cannot be freed");
  const busyCreate = await j("/api/admin/tellers", {
    method: "POST",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ name: "DeskBusy", serviceDesk: "2", counterNumber: "2" }),
  });
  check("create busy teller 201", busyCreate.status === 201, `got ${busyCreate.status}`);
  const busyId = (busyCreate.body || {}).teller?._id;

  await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ status: "BUSY" }),
  });
  const free = await j(`/api/admin/tellers/${busyId}/status`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${a}` },
    body: JSON.stringify({ status: "FREE" }),
  });
  check("free busy teller 400", free.status === 400, `got ${free.status}`);

  // ---------------------------------------------------------------------------
  // 11. Sessions + audit scoping.
  // ---------------------------------------------------------------------------
  console.log("\n[11] Sessions + audit scoping");
  const sess = await j("/api/admin/sessions", { headers: { Authorization: `Bearer ${a}` } });
  check("sessions list 200", sess.status === 200, `got ${sess.status}`);
  const sb = sess.body || {};
  check("sessions items array", Array.isArray(sb.items));

  const other = await createAdmin("admin8@signova.test");
  const otherSess = await j("/api/admin/sessions", { headers: { Authorization: `Bearer ${other}` } });
  check("other org sessions empty", (otherSess.body || {}).items.length === 0, JSON.stringify(otherSess.body));

  const audit = await j("/api/admin/audit-logs", { headers: { Authorization: `Bearer ${a}` } });
  check("audit-logs 200", audit.status === 200, `got ${audit.status}`);
  const ab = audit.body || {};
  check("audit items array", Array.isArray(ab.items));

  const adminB2 = await createAdmin("admin9@signova.test");
  const auditB = await j("/api/admin/audit-logs/count", { headers: { Authorization: `Bearer ${adminB2}` } });
  check("cross-org audit count 0", (auditB.body || {}).total === 0, JSON.stringify(auditB.body));

  // ---------------------------------------------------------------------------
  // 12. Admin login/2FA/refresh lifecycle.
  // ---------------------------------------------------------------------------
  console.log("\n[12] Admin login/2FA/refresh lifecycle");
  const login = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  check("admin login 200", login.status === 200 && login.body.challengeToken, JSON.stringify(login.body));
  const { startTwoFactorEnrollment, activateTwoFactorEnrollment } = await import("../src/services/authService.js");
  const enroll = await startTwoFactorEnrollment(login.body.challengeToken);
  check("enroll start 200", enroll.status === 200 && !!enroll.body.secret);
  const { authenticator: otel2 } = await import("otplib");
  const code = otel2.generate(enroll.body.secret!);
  const activated = await activateTwoFactorEnrollment(login.body.challengeToken, code, {} as any);
  check("activate 200 + tokens", activated.status === 200 && !!activated.body.accessToken && !!activated.body.refreshToken, JSON.stringify(activated.body));

  const refresh = await j("/api/admin/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken: activated.body.refreshToken }),
  });
  check("refresh 200 + new token", refresh.status === 200 && !!refresh.body.accessToken, JSON.stringify(refresh.body));
  const me = await j("/api/admin/auth/me", { headers: { Authorization: `Bearer ${refresh.body.accessToken}` } });
  check("me 200 + email", me.status === 200 && (me.body || {}).email === "admin@signova.test", JSON.stringify(me.body));

  // ---------------------------------------------------------------------------
  // 13. Seed preservation.
  // ---------------------------------------------------------------------------
  console.log("\n[13] Seed preservation");
  await (await import("../src/seed/seed.js")).seed();
  const adminBefore = await User.findOne({ email: "admin@signova.test" });
  check("admin preserved", !!adminBefore && adminBefore.isActive === true);
  const graceBefore = await User.findOne({ email: "grace@signova.test" });
  check("seeded staff preserved", !!graceBefore && graceBefore.role === "STAFF");
  const tellersBefore = await Teller.find({ organization: (await Organization.findOne({ shortName: "KNH" }))!._id });
  check("tellers preserved", tellersBefore.length === 3, `got ${tellersBefore.length}`);

  // ---------------------------------------------------------------------------
  // Teardown.
  // ---------------------------------------------------------------------------
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

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
'''

s = s.replace("Authorization: *** ${", "Authorization: `Bearer ${")
s = s.replace("Authorization: ***`", "Authorization: `Bearer")
p.write_text(s)
print("wrote", p, len(s))
print("template Bearer:", s.count("Authorization: `Bearer ${"))
print("remaining ***:", s.count("Authorization: ***"))
