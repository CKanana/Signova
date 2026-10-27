import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { User } from "../src/models/user.js";
(async () => {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
  await import("../src/seed/seed.js");
  const admin = await User.findOne({ email: "admin@signova.test" });
  console.log("admin found:", !!admin);
  console.log("admin isActive:", admin?.isActive);
  console.log("admin twoFactorEnabled:", admin?.twoFactorEnabled);
  console.log("admin passwordHash:", admin?.passwordHash?.slice(0, 30) + "...");
  s.close(() => process.exit(0));
})().catch(e => { console.error("FATAL", e); process.exit(1); });
