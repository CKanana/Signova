import { Organization } from "../models/organization.js";
import { User } from "../models/user.js";
import { Teller } from "../models/teller.js";
import { hashPassword } from "../services/tokenService.js";

/**
 * Development seed. Creates a single organization with an admin, three staff
 * users, and three tellers. Safe to run repeatedly — it wipes the demo org
 * (by shortName) first.
 *
 * NOTE: seeded passwords are development-only and printed to the console.
 */

const ORG_SHORTNAME = "KNH";

const STAFF_SEED = [
  { name: "Grace Wanjiku", email: "grace@signova.test", password: "Password123!" },
  { name: "Brian Otieno", email: "brian@signova.test", password: "Password123!" },
  { name: "Njeri Kamau", email: "njeri@signova.test", password: "Password123!" },
];

const ADMIN_SEED = { name: "Signova Admin", email: "admin@signova.test", password: "Password123!" };

const TELLERS_SEED = [
  { name: "Grace Wanjiku", serviceLabel: "Kenyan Sign Language · English", serviceDesk: "Customer Support · Main Reception", counterNumber: "04", pairingCode: "KNH01", staffIndex: 0 },
  { name: "Brian Otieno", serviceLabel: "Kenyan Sign Language · English", serviceDesk: "Patient Services · West Wing", counterNumber: "02", pairingCode: "KNH02", staffIndex: 1 },
  { name: "Njeri Kamau", serviceLabel: "Kenyan Sign Language · English", serviceDesk: "Outpatient Services · Ground Floor", counterNumber: "07", pairingCode: "KNH03", staffIndex: 2 },
];

export async function seed(): Promise<void> {
  // Clean slate for the demo org.
  const existing = await Organization.findOne({ shortName: ORG_SHORTNAME });
  if (existing) {
    await User.deleteMany({ organization: existing._id });
    await Teller.deleteMany({ organization: existing._id });
    await Organization.deleteOne({ _id: existing._id });
    // eslint-disable-next-line no-console
    console.log(`[seed] removed existing org "${ORG_SHORTNAME}"`);
  }

  const org = await Organization.create({
    name: "Kenyatta National Hospital",
    shortName: ORG_SHORTNAME,
    welcomeMessage: "Communication support is available in sign language or text.",
    serviceName: "Customer Support",
    counterLabel: "Counter Tablet",
    colors: { primary: "#5B2A86", background: "#FFF8DC" },
  });

  const admin = await User.create({
    organization: org._id,
    role: "ADMIN",
    name: ADMIN_SEED.name,
    email: ADMIN_SEED.email,
    passwordHash: await hashPassword(ADMIN_SEED.password),
  });

  const staffUsers = [];
  for (const s of STAFF_SEED) {
    staffUsers.push(
      await User.create({
        organization: org._id,
        role: "STAFF",
        name: s.name,
        email: s.email,
        passwordHash: await hashPassword(s.password),
      }),
    );
  }

  for (const t of TELLERS_SEED) {
    const staffMember = staffUsers[t.staffIndex];
    if (!staffMember) continue;
    await Teller.create({
      organization: org._id,
      name: t.name,
      serviceLabel: t.serviceLabel,
      serviceDesk: t.serviceDesk,
      counterNumber: t.counterNumber,
      pairingCode: t.pairingCode,
      staffUser: staffMember._id,
      status: "FREE",
    });
  }

  // eslint-disable-next-line no-console
  console.log(`
[seed] Organization: ${org.name} (${org.shortName})
[seed] Admin:   ${ADMIN_SEED.email} / ${ADMIN_SEED.password}
[seed] Staff:   ${STAFF_SEED.map((s) => s.email).join(", ")} / ${STAFF_SEED[0]?.password}
[seed] Tellers: ${TELLERS_SEED.map((t) => `${t.counterNumber} (${t.pairingCode})`).join(", ")}
[seed] NOTE: 2FA is not enabled on seeded accounts. On first login each user
       will be asked to enroll an authenticator app before receiving a token.
`);
}
