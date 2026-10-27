import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { fileURLToPath } from "node:url";
import { createTestApp } from "../src/test/app.js";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  console.log("DB connected");

  await import("../server/src/seed/seed.js");
  console.log("seeded");

  const app = createTestApp();
  const http = await import("node:http");
  const s = http.createServer(app);
  await new Promise((resolve) => s.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${s.address().port}`;
  console.log("LISTEN", base);

  const fetch = await import("node:fetch");
  const login = await fetch(`${base}/api/admin/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: "admin@signova.test", password: "Password123!" }),
  });
  const body = await login.json().catch(() => ({}));
  console.log("admin login status", login.status, JSON.stringify(body).slice(0, 120));

  s.close(() => process.exit(0));
})().catch((e) => {
  console.error("FATAL", e);
  process.exit(1);
});
