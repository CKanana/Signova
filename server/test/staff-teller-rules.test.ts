/**
 * STAFF-TELLER-RULES: staff teller rules (M3-style assertions).
 *
 * All in ONE organisation (orgA / KNH).
 *   (a) a staff user changes the availability of their OWN assigned
 *       teller: allowed (200)
 *   (b) the same user tries PATCH /api/tellers/:id/availability on
 *       ANOTHER teller in the same organisation: denied (403 or 404)
 *       and that teller's status is unchanged in the database
 *   (c) a staff user calls three /api/admin routes: denied
 *   (d) a staff user can change ANOTHER teller's availability
 *       (real finding: route lacks role + org scoping)
 *
 * Runs against an in-memory MongoDB (mongodb-memory-server) only.
 */
import { test, before, after } from "node:test";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import http from "node:http";
import { v4 as uuidv4 } from "uuid";
import { authenticator } from "otplib";
import { User } from "../src/models/user.js";
import { Teller } from "../src/models/teller.js";

// --- harness ---
let mongod: any;
let server: http.Server;
let base: string;
let orgA: any;
let orgAId: string;
let tellerA: any;
let tellerB: any;
let adminTokenA: string;

function check(name: string, cond: boolean, detail = ""): void {
  if (cond) {
    console.log("  PASS  " + name);
  } else {
    console.log("  FAIL  " + name + " " + detail);
    process.exitCode = 1;
  }
}

function authHeader(token: string): any {
  return { headers: { authorization: "Bearer " + token } };
}

async function login(email: string, password: string) {
  const { login } = await import("../src/services/authService.js");
  return login(email, password, {} as any);
}

async function startTwoFactorEnrollment(challengeToken: string) {
  const { startTwoFactorEnrollment } = await import("../src/services/authService.js");
  return startTwoFactorEnrollment(challengeToken);
}

async function activateTwoFactorEnrollment(challengeToken: string, code: string) {
  const { activateTwoFactorEnrollment } = await import("../src/services/authService.js");
  return activateTwoFactorEnrollment(challengeToken, code, {} as any);
}

async function loginWith2FA(email: string, password: string) {
  const loginRes = await login(email, password, {} as any);
  if (loginRes.status === "authenticated") return loginRes;
  if (loginRes.status === "2fa_required" || loginRes.status === "mfa_enroll_required") {
    const enroll = await startTwoFactorEnrollment(loginRes.challengeToken!);
    const code = authenticator.generate(enroll.secret);
    const activated = await activateTwoFactorEnrollment(loginRes.challengeToken!, code, {} as any);
    return activated;
  }
  throw new Error("Unexpected login status: " + loginRes.status);
}

before(async () => {
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

  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  mongod = mem;
  await mongoose.connect(mem.getUri());

  const { seed } = await import("../src/seed/seed.js");
  await seed();

  const { createTestApp } = await import("../src/test/app.js");
  server = http.createServer(await createTestApp());
  await new Promise((resolve) => server.listen(0, () => resolve()));
  base = "http://127.0.0.1:" + server.address().port;

  const { Organization } = await import("../src/models/organization.js");
  orgA = await Organization.findOne({ shortName: "KNH" })!;
  orgAId = orgA._id.toString();
  tellerA = await Teller.findOne({ organization: orgA._id })!;
  tellerB = await Teller.findOne({ organization: orgA._id, _id: { $ne: tellerA._id } })!;

  // Admin login with full 2FA.
  const admin = await loginWith2FA("admin@signova.test", "Password123!");
  adminTokenA = admin.accessToken!;
});


after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await mongoose.disconnect();
  if (mongod) await mongod.stop();
});


// ===== (a) staff changes OWN assigned teller availability: allowed =====

test("staff: may change own assigned teller availability (200)", async () => {
  const thisEmail = "home.staff.a." + uuidv4() + "@signova.test";
  // Clean up the staff user created by earlier tests, if any.
  await User.deleteMany({ email: thisEmail });

  // Create an active staff user and assign them to tellerA (their own
  // assigned teller) via the admin route.
  const staffUser = await User.create({
    organization: orgAId,
    role: "STAFF",
    name: "Home Staff",
    email: thisEmail,
    passwordHash: await (await import("../src/services/tokenService.js")).hashPassword("Password123!"),
    isActive: true,
  });
  const staffLogin = await loginWith2FA(thisEmail, "Password123!");
  const staffToken = staffLogin.accessToken!;

  // Ensure the staff is assigned to tellerA.
  const assignRes = await fetch(
    base + "/api/admin/tellers/" + tellerA._id + "/assign",
    {
      method: "POST",
      headers: authHeader(adminTokenA),
      body: JSON.stringify({ staffUserId: staffUser._id.toString() }),
    }
  );
  check("admin assigns staff to tellerA", assignRes.status === 200, "got " + assignRes.status);

  // Staff now changes tellerA's availability (their own assigned teller).
  const before = await Teller.findById(tellerA._id).select("status");
  const res = await fetch(base + "/api/tellers/" + tellerA._id + "/availability", {
    method: "PATCH",
    headers: authHeader(staffToken),
    body: JSON.stringify({ status: "BUSY" }),
  });
  const after = await Teller.findById(tellerA._id).select("status");
  check("own assigned teller availability change returns 200", res.status === 200, "got " + res.status);
});

// ===== (b) same staff user, ANOTHER teller in same org: denied =====

test("staff: another teller in same org denied (403 or 404)", async () => {
  const thisEmail = "home.staff.b." + uuidv4() + "@signova.test";
  const staffUser = await User.create({
    organization: orgAId,
    role: "STAFF",
    name: "Home Staff",
    email: thisEmail,
    passwordHash: await (await import("../src/services/tokenService.js")).hashPassword("Password123!"),
    isActive: true,
  });
  const staffLogin = await loginWith2FA(thisEmail, "Password123!");
  const staffToken = staffLogin.accessToken!;

  const statusBefore = await Teller.findById(tellerB._id).select("status");
  const res = await fetch(base + "/api/tellers/" + tellerB._id + "/availability", {
    method: "PATCH",
    headers: authHeader(staffToken),
    body: JSON.stringify({ status: "BUSY" }),
  });
  const statusAfter = await Teller.findById(tellerB._id).select("status");

  check(
    "another teller availability change denied (403 or 404)",
    res.status === 403 || res.status === 404,
    "got " + res.status
  );
  check(
    "tellerB status unchanged in DB",
    statusBefore?.status === statusAfter?.status,
    "before=" + statusBefore?.status + " after=" + statusAfter?.status
  );
});

// ===== (c) staff calls three /api/admin routes: all denied =====

test("staff: cannot call /api/admin routes (denied)", async () => {
  const thisEmail = "home.staff.c." + uuidv4() + "@signova.test";
  const staffUser = await User.create({
    organization: orgAId,
    role: "STAFF",
    name: "Home Staff",
    email: thisEmail,
    passwordHash: await (await import("../src/services/tokenService.js")).hashPassword("Password123!"),
    isActive: true,
  });
  const staffLogin = await loginWith2FA(thisEmail, "Password123!");
  const staffToken = staffLogin.accessToken!;

  const r1 = await fetch(base + "/api/admin/overview", { method: "GET", headers: authHeader(staffToken) });
  check("admin: GET /overview denied (401 for non-admin)", r1.status === 401, "got " + r1.status);

  const r2 = await fetch(base + "/api/admin/tellers", { method: "GET", headers: authHeader(staffToken) });
  check("admin: GET /tellers denied (401 for non-admin)", r2.status === 401, "got " + r2.status);

  const r3 = await fetch(base + "/api/admin/staff", { method: "GET", headers: authHeader(staffToken) });
  check("admin: GET /staff denied (401 for non-admin)", r3.status === 401, "got " + r3.status);
});

// ===== (d) staff CAN change another teller's availability (real finding) =====

test("staff: another teller availability change NOT denied (permission gap)", async () => {
  const thisEmail = "home.staff.d." + uuidv4() + "@signova.test";
  const staffUser = await User.create({
    organization: orgAId,
    role: "STAFF",
    name: "Home Staff",
    email: thisEmail,
    passwordHash: await (await import("../src/services/tokenService.js")).hashPassword("Password123!"),
    isActive: true,
  });
  const staffLogin = await loginWith2FA(thisEmail, "Password123!");
  const staffToken = staffLogin.accessToken!;

  // Ensure the staff is assigned to tellerA (not needed for the check, but
  // keeps the story consistent).
  const assignRes = await fetch(
    base + "/api/admin/tellers/" + tellerA._id + "/assign",
    {
      method: "POST",
      headers: authHeader(adminTokenA),
      body: JSON.stringify({ staffUserId: staffUser._id.toString() }),
    }
  );
  check("admin assigns staff to tellerA", assignRes.status === 200, "got " + assignRes.status);

  const statusBefore = await Teller.findById(tellerB._id).select("status");
  const res = await fetch(base + "/api/tellers/" + tellerB._id + "/availability", {
    method: "PATCH",
    headers: authHeader(staffToken),
    body: JSON.stringify({ status: "BUSY" }),
  });
  const statusAfter = await Teller.findById(tellerB._id).select("status");

  check(
    "PATCH another teller availability returns 200 (not denied)",
    res.status === 200,
    "got " + res.status
  );
  check(
    "tellerB status changed to BUSY (role gap - see phase-5 plan finding)",
    statusAfter?.status === "BUSY",
    "before=" + statusBefore?.status + " after=" + statusAfter?.status
  );
});
