import { Organization } from "../models/organization.js";
import { User } from "../models/user.js";
import { Teller } from "../models/teller.js";
import { hashPassword } from "../services/tokenService.js";
const ADMIN_SEED = { name: "Signova Admin", email: "admin@signova.test" };
const ORG_SEEDS = [
    {
        name: "Kenyatta National Hospital",
        shortName: "KNH",
        welcomeMessage: "Communication support is available in sign language or text.",
        serviceName: "Customer Support",
        counterLabel: "Counter Tablet",
        staff: [
            { name: "Grace Wanjiku", email: "grace@signova.test", password: "Password123!" },
            { name: "Brian Otieno", email: "brian@signova.test", password: "Password123!" },
            { name: "Njeri Kamau", email: "njeri@signova.test", password: "Password123!" },
        ],
        tellers: [
            { name: "Grace Wanjiku", serviceLabel: "Kenyan Sign Language · English", serviceDesk: "Customer Support · Main Reception", counterNumber: "04", pairingCode: "KNH01", staffIndex: 0 },
            { name: "Brian Otieno", serviceLabel: "Kenyan Sign Language · English", serviceDesk: "Patient Services · West Wing", counterNumber: "02", pairingCode: "KNH02", staffIndex: 1 },
            { name: "Njeri Kamau", serviceLabel: "Kenyan Sign Language · English", serviceDesk: "Outpatient Services · Ground Floor", counterNumber: "07", pairingCode: "KNH03", staffIndex: 2 },
        ],
    },
    {
        name: "Moi Teaching and Referral Hospital",
        shortName: "MTRH",
        welcomeMessage: "Communication support is available in sign language or text.",
        serviceName: "Customer Support",
        counterLabel: "Counter Tablet",
        staff: [
            { name: "Alice Chebet", email: "alice@signova.test", password: "Password123!" },
        ],
        tellers: [
            { name: "Alice Chebet", serviceLabel: "Kenyan Sign Language · English", serviceDesk: "Main Reception · Eldoret", counterNumber: "01", pairingCode: "MTRH01", staffIndex: 0 },
        ],
    },
];
const ALLOWED_DOMAINS = {
    KNH: ["gmail.com", "signova.test"],
    MTRH: ["strathmore.edu"],
};
export async function seed() {
    for (const orgSeed of ORG_SEEDS) {
        const org = await Organization.findOneAndUpdate({ shortName: orgSeed.shortName }, {
            $setOnInsert: {
                name: orgSeed.name,
                welcomeMessage: orgSeed.welcomeMessage,
                serviceName: orgSeed.serviceName,
                counterLabel: orgSeed.counterLabel,
                restrictRegistrationByDomain: true,
                allowedEmailDomains: ALLOWED_DOMAINS[orgSeed.shortName] ?? [],
            },
            $set: {
                colors: { primary: "#5B2A86", background: "#FFF8DC" },
                ...(orgSeed.shortName === "KNH" ? { bootstrapAdminException: true, bootstrapAdminEmail: "crystal.kanana@strathmore.edu" } : {}),
            },
        }, { new: true, upsert: true });
        await seedStaff(org);
        await seedTellers(org, orgSeed);
    }
    const knh = await Organization.findOne({ shortName: "KNH" });
    if (knh) {
        await seedKnhAdmin(knh);
    }
    // eslint-disable-next-line no-console
    console.log(`[seed] Staff:   ${ORG_SEEDS[0]?.staff.map((s) => s.email).join(", ")} / ${ORG_SEEDS[0]?.staff[0]?.password}\n[seed] Public sign-up is currently disabled. Staff are invited by administrators only.`);
}
async function seedStaff(org) {
    const existing = await User.find({ organization: org._id, role: "STAFF" });
    const byEmail = new Map(existing.map((u) => [u.email, u]));
    const orgSeed = ORG_SEEDS.find((o) => o.shortName === org.shortName);
    if (!orgSeed)
        return;
    for (const s of orgSeed.staff) {
        const found = byEmail.get(s.email);
        if (found)
            continue;
        await User.create({
            organization: org._id,
            role: "STAFF",
            name: s.name,
            email: s.email,
            passwordHash: await hashPassword(s.password),
        });
    }
}
async function seedTellers(org, orgSeed) {
    const existingCount = await Teller.countDocuments({ organization: org._id });
    if (existingCount > 0)
        return;
    const staff = await User.find({ organization: org._id, role: "STAFF" });
    const byEmail = new Map(staff.map((u) => [u.email, u]));
    for (const t of orgSeed.tellers) {
        const member = byEmail.get(orgSeed.staff[t.staffIndex]?.email);
        if (!member)
            continue;
        await Teller.create({
            organization: org._id,
            name: t.name,
            serviceLabel: t.serviceLabel,
            serviceDesk: t.serviceDesk,
            counterNumber: t.counterNumber,
            pairingCode: t.pairingCode,
            staffUser: member._id,
            status: "FREE",
        });
    }
}
async function seedKnhAdmin(org) {
    const existingAdmin = await User.findOne({ email: "admin@signova.test" });
    if (!existingAdmin) {
        await User.create({
            organization: org._id,
            role: "ADMIN",
            name: "Signova Admin",
            email: "admin@signova.test",
            passwordHash: await hashPassword("Password123!"),
            isActive: true,
            twoFactorEnabled: false,
        });
    }
    const bootstrapEmail = "crystal.kanana@strathmore.edu";
    const bootstrapUser = await User.findOne({ email: bootstrapEmail });
    if (!bootstrapUser) {
        await User.create({
            organization: org._id,
            role: "ADMIN",
            name: "Crystal Kanana",
            email: bootstrapEmail,
            isActive: false,
        });
    }
}
//# sourceMappingURL=seed.js.map