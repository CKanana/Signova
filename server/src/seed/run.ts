import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { config } from "../config/env.js";
import { seed } from "../seed/seed.js";

// ---- M0.5 guard: refuse to seed a non-test DB or in production ----
const isTestEnv =
  process.env.NODE_ENV === "test" || process.env.NODE_ENV === "development";
const dbName = config.mongodbUri.split("/").pop() ?? "";

if (!isTestEnv) {
  console.error(
    `[seed:test] REFUSED: NODE_ENV=${process.env.NODE_ENV ?? "undefined"} ` +
      "(must be development or test).",
  );
  process.exit(1);
}
if (!dbName.endsWith("_test")) {
  console.error(
    `[seed:test] REFUSED: NODE_ENV=${process.env.NODE_ENV ?? "undefined"} ` +
      "(must be development or test).",
  );
  process.exit(1);
}
if (!dbName.endsWith("_test")) {
  console.error(
    `[seed:test] REFUSED: MONGODB_URI database name "${dbName}" does not end with "_test".`,
  );
  console.error(
    "[seed:test]      Set NODE_ENV=development or test and MONGODB_URI=<...>/_test.",
  );
  process.exit(1);
}
// ---- end M0.5 guard ----

async function main() {
  await connectDatabase();
  await seed();
  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error("[seed] failed:", err);
  process.exit(1);
});
