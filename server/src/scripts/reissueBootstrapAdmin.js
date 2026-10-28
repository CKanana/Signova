import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Organization } from "../models/organization.js";
import { User } from "../models/user.js";
import { SetupToken } from "../models/setupToken.js";
import { randomToken, hashToken } from "../utils/crypto.js";
import { sendMail, buildSetupEmail } from "../services/mailService.js";
import { recordAudit } from "../services/auditService.js";
import { config, BOOTSTRAP_SETUP_TOKEN_TTL_MS } from "../config/env.js";
async function main() {
    await connectDatabase();
    const knh = await Organization.findOneAndUpdate({ shortName: "KNH" }, {
        $setOnInsert: { name: "Kenyatta National Hospital" },
        $set: { bootstrapAdminException: true, bootstrapAdminEmail: "crystal.kanana@strathmore.edu" },
    }, { new: true, upsert: true });
    const email = "crystal.kanana@strathmore.edu";
    const user = await User.findOne({ email });
    if (!user) {
        console.log("ADMIN_NOT_FOUND");
        await disconnectDatabase();
        process.exit(1);
    }
    if (user.isActive) {
        console.log("ADMIN_ALREADY_ACTIVE");
        await disconnectDatabase();
        process.exit(0);
    }
    await SetupToken.deleteMany({ user: user._id, scope: "bootstrap", usedAt: { $exists: false } });
    const raw = randomToken(32);
    const tokenHash = hashToken(raw);
    const expiresAt = new Date(Date.now() + BOOTSTRAP_SETUP_TOKEN_TTL_MS);
    await SetupToken.create({
        user: user._id,
        tokenHash,
        scope: "bootstrap",
        expiresAt,
    });
    const baseUrl = config.adminPortalUrl;
    const setupUrl = `${baseUrl}/admin-setup?token=${encodeURIComponent(raw)}`;
    const emailPayload = buildSetupEmail(user.name, knh.name, setupUrl, expiresAt);
    const sent = await sendMail({
        to: user.email,
        subject: emailPayload.subject,
        text: emailPayload.text,
        html: emailPayload.html,
    });
    await recordAudit({
        action: "BOOTSTRAP_SETUP_EMAIL_SENT",
        organization: String(knh._id),
        actor: user._id,
        target: user._id.toString(),
        meta: { sent },
    });
    console.log(sent ? "EMAIL_SENT" : "EMAIL_FAILED");
    await disconnectDatabase();
    process.exit(0);
}
main().catch((err) => {
    console.error("FATAL:", err);
    process.exit(1);
});
//# sourceMappingURL=reissueBootstrapAdmin.js.map