import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { config } from "../src/config/env.js";
import { seed } from "../src/seed/seed.js";
import { createTestApp } from "../src/test/app.js";
import { User } from "../src/models/user.js";
import { startTwoFactorEnrollment, activateTwoFactorEnrollment, verifyAccessToken } from "../src/services/authService.js";
import { authenticator } from "otplib";
import { createServer } from "node:http";

let mongod: any, base: string, serverInstance: any;

async function main() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  await seed();

  const app = createTestApp();
  serverInstance = createServer(app);
  await new Promise<void>((resolve) => serverInstance.listen(0, "127.0.0.1", () => resolve()));
  base = `http://127.0.0.1:${serverInstance.address().port}`;
  console.log("BASE", base);

  const g = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "grace@signova.test", password: "Password123!" }),
  });
  const gbody = await g.json();
  console.log("LOGIN status", g.status, "body", JSON.stringify(gbody).slice(0, 200));

  const enroll = await startTwoFactorEnrollment(gbody.challengeToken);
  console.log("ENROLL secret", enroll.secret ? enroll.secret.slice(0,10) : null);
  const code = authenticator.generate(enroll.secret);
  const activated = await activateTwoFactorEnrollment(gbody.challengeToken, code, {} as any);
  console.log("ACTIVATED status", activated.status, "token", activated.accessToken ? activated.accessToken.slice(0,20) : null);

  const { signAccessToken } = await import("../src/utils/jwt.js");
  const payload = signAccessToken({ sub: "grace", orgId: "org-a", role: "STAFF" });
  console.log("forged role STAFF token", payload.slice(0,20));
  console.log("verify STAFF token", JSON.stringify(verifyAccessToken(payload)));

  const res = await fetch(`${base}/api/admin/overview`, {
    headers: { Authorization: `Bearer ${activated.accessToken}` },
  });
  console.log("ADMIN overview with staff token ->", res.status);
}

main().catch(e => { console.error("FATAL", e); process.exit(1); });
