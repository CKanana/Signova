import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { User } from "../models/user.js";
import { SetupToken } from "../models/setupToken.js";
import { decryptSecret } from "../utils/crypto.js";

async function main() {
  await connectDatabase();

  const user = await User.findOne({ email: "crystal.kanana@strathmore.edu" }).select("+totpSecret +totpLastUsedStep");
  if (!user) {
    console.log("USER_NOT_FOUND");
    await disconnectDatabase();
    process.exit(1);
  }

  const rawSecret = (user as any).totpSecret;
  let canDecrypt = false;
  if (rawSecret && typeof rawSecret === "string") {
    try {
      const decrypted = decryptSecret(rawSecret);
      canDecrypt = decrypted.length > 0;
    } catch {
      canDecrypt = false;
    }
  }

  const unusedTokens = await SetupToken.countDocuments({
    user: user._id,
    scope: "bootstrap",
    usedAt: { $exists: false },
    expiresAt: { $gt: new Date() },
  });

  console.log(JSON.stringify({
    userId: user._id.toString(),
    isActive: user.isActive,
    twoFactorEnabled: user.twoFactorEnabled,
    hasTotpSecret: Boolean(rawSecret),
    totpLastUsedStepPresent: Boolean((user as any).totpLastUsedStep),
    canDecryptSecret: canDecrypt,
    unusedValidBootstrapTokens: unusedTokens,
  }));

  await disconnectDatabase();
  process.exit(0);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
