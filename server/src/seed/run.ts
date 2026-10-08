import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { seed } from "../seed/seed.js";

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
