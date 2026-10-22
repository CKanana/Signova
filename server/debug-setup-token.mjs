import { MongoMemoryServer } from "mongodb-memory-server";

process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "placeholder";

async function main() {
  const mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  const { connectDatabase } = await import("./src/config/db.js");
  const { SetupToken } = await import("./src/models/setupToken.js");
  const { hashToken, randomToken } = await import("./src/utils/crypto.js");
  const { User } = await import("./src/models/user.js");
  const { seed } = await import("./src/seed/seed.js");
  await connectDatabase();
  await seed();

  const raw = randomToken(32);
  const hash = hashToken(raw);
  const user = await User.findOne({ email: "crystal.kanana@strathmore.edu" });
  await SetupToken.create({ user: user._id, tokenHash: hash, scope: "bootstrap", expiresAt: new Date(Date.now() + 100000) });

  const before = await SetupToken.findOne({ tokenHash: hash });
  console.log("before", before?.toObject());

  const consumed = await SetupToken.findOneAndUpdate(
    { tokenHash: hash, usedAt: { $exists: false } },
    { $set: { usedAt: new Date() } },
    { new: true }
  );
  console.log("consumed", consumed?.toObject());

  const after = await SetupToken.findOne({ tokenHash: hash });
  console.log("after", after?.toObject());

  await SetupToken.deleteMany({});
  await User.deleteMany({});
  await mem.stop();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
