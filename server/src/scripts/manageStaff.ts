import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { User } from "../models/user.js";
import { Organization } from "../models/organization.js";
import { recordAudit } from "../services/auditService.js";
import { revokeAllRefreshTokens } from "../services/tokenService.js";

/**
 * Secure Operator CLI for Interim Staff Account Approvals.
 *
 * Usage:
 *   npx tsx src/scripts/manageStaff.ts list-pending
 *   npx tsx src/scripts/manageStaff.ts approve <email>
 *   npx tsx src/scripts/manageStaff.ts deactivate <email>
 */

async function main() {
  const [command, emailArg] = process.argv.slice(2);

  if (!command || !["list-pending", "approve", "deactivate"].includes(command)) {
    console.log("Usage:");
    console.log("  npx tsx src/scripts/manageStaff.ts list-pending");
    console.log("  npx tsx src/scripts/manageStaff.ts approve <email>");
    console.log("  npx tsx src/scripts/manageStaff.ts deactivate <email>");
    process.exit(1);
  }

  await connectDatabase();

  try {
    if (command === "list-pending") {
      const pendingUsers = await User.find({ role: "STAFF", isActive: false }).sort({ createdAt: -1 });
      if (pendingUsers.length === 0) {
        console.log("No pending staff registrations found.");
        return;
      }
      console.log(`Found ${pendingUsers.length} pending staff registration(s):`);
      for (const u of pendingUsers) {
        const org = await Organization.findById(u.organization);
        console.log(`  - Name: ${u.name}`);
        console.log(`    Email: ${u.email}`);
        console.log(`    Organization: ${org?.name || u.organization} (${org?.shortName || "N/A"})`);
        console.log(`    Registered: ${u.createdAt.toISOString()}`);
        console.log(`    ID: ${u._id.toString()}\n`);
      }
      return;
    }

    if (!emailArg) {
      console.error(`Error: email argument is required for command "${command}".`);
      process.exit(1);
    }

    const email = emailArg.toLowerCase().trim();
    const user = await User.findOne({ email, role: "STAFF" });

    if (!user) {
      console.error(`Error: No staff user found with email "${email}".`);
      process.exit(1);
    }

    if (command === "approve") {
      if (user.isActive) {
        console.log(`User "${email}" is already active and approved.`);
        return;
      }
      user.isActive = true;
      await user.save();
      await recordAudit({
        action: "STAFF_ACTIVATE",
        target: user._id.toString(),
        organization: user.organization,
        meta: { approvedVia: "cli" },
      });
      console.log(`Success: Staff user "${email}" (${user.name}) is now APPROVED and active.`);
      console.log("They may now log in to the staff workspace and complete 2FA enrollment.");
      return;
    }

    if (command === "deactivate") {
      user.isActive = false;
      await user.save();
      await revokeAllRefreshTokens(user._id.toString());
      await recordAudit({
        action: "STAFF_DEACTIVATE",
        target: user._id.toString(),
        organization: user.organization,
        meta: { deactivatedVia: "cli" },
      });
      console.log(`Success: Staff user "${email}" (${user.name}) has been deactivated and all active refresh tokens revoked.`);
      return;
    }
  } finally {
    await disconnectDatabase();
  }
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
