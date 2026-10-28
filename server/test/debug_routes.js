import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { createTestApp } from "../src/test/app.js";

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  await import("../src/seed/seed.js");

  const app = createTestApp();
  const http = await import("node:http");
  const s = http.createServer(app);
  await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${s.address().port}`;

  const j = async (path, opts = {}) => {
    const res = await fetch(`${base}${path}`, {
      ...opts,
      headers: { "content-type": "application/json", ...(opts.headers || {}) },
    });
    return { status: res.status, body: await res.json().catch(() => null) };
  };

  // 1. Login as seeded admin
  const adminLogin = await j("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  console.log("1 admin login:", adminLogin.status, JSON.stringify(adminLogin.body).slice(0, 250));

  // 2. Login as grace (staff, 2FA enrolled) to compare
  const graceLogin = await j("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "grace@signova.test", password: "Password123!" }),
  });
  console.log("2 grace login:", graceLogin.status, JSON.stringify(graceLogin.body).slice(0, 250));

  // 3. Register a second admin via /api/admin/staff (requires admin token)
  const adminToken = adminLogin.body.accessToken;
  const staff = await j("/api/admin/staff", {
    method: "POST",
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ name: "T1", email: "adminx@signova.test", role: "ADMIN", orgId: "org-a" }),
  });
  console.log("3 create admin via /api/admin/staff:", staff.status, JSON.stringify(staff.body).slice(0, 250));

  // 4. Re-login with the new admin
  const staffLogin = await j("/api/admin/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "adminx@signova.test", password: "Password123!" }),
  });
  console.log("4 login as new admin:", staffLogin.status, JSON.stringify(staffLogin.body).slice(0, 250));

  s.close(() => process.exit(0));
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
