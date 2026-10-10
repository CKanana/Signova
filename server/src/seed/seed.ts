import { Organization } from "../models/organization.js";
import { User } from "../models/user.js";
import { Teller } from "../models/teller.js";
import { hashPassword } from "../services/tokenService.js";

/**
 * Development seed. Creates two organizations — an admin, staff users and
 * tellers in the primary one — and is safe to run repeatedly: every
 * organization it owns (matched by shortName) is wiped and recreated, so
 * re-running never duplicates organizations, users or tellers.
 *
 * The registration-domain policy fields are seeded on the primary org so
 * the public sign-up page's behaviour is demonstrable:
 *   - KNH: restrictRegistrationByDomain ON with gmail.com + signova.test
 *   - MTRH: restrictRegistrationByDomain ON with strathmore.edu only
 *
 * NOTE: public registration itself is currently gmail.com only and is
 * enforced in authService.registerStaff — these per-org lists exist so
 * the Phase 4 Admin Portal has real policy data to manage.
 *
 * NOTE: seeded passwords are development-only and printed to the console.
 */

const ADMIN_SEED = { name: "Signova Admin", email: "admin@signova.test", password: "Password123!" };

interface OrgSeed {
  name: string;
  shortName: string;
  welcomeMessage: string;
  serviceName: string;
  counterLabel: string;
  staff: Array<{ name: string; email: string; password: string }>;
  tellers: Array<{
    name: string;
    serviceLabel: string;
    serviceDesk: string;
    counterNumber: string;
    pairingCode: string;
    staffIndex: number;
  }>;
}

const ORG_SEEDS: OrgSeed[] = [
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

/** Domains each organization approves for public registration. */
const ALLOWED_DOMAINS: Record<string, string[]> = {
  KNH: ["gmail.com", "signova.test"],
  MTRH: ["strathmore.edu"],
};

async function wipeOrganization(shortName: string): Promise<void> {
  const existing = await Organization.findOne({ shortName });
  if (!existing) return;
  await User.deleteMany({ organization: existing._id });
  await Teller.deleteMany({ organization: existing._id });
  await Organization.deleteOne({ _id: existing._id });
  // eslint-disable-next-line no-console
  console.log(`[seed] removed existing org "${shortName}"`);
}

export async function seed(): Promise<void> {
  for (const orgSeed of ORG_SEEDS) {
    await wipeOrganization(orgSeed.shortName);
  }

  for (const orgSeed of ORG_SEEDS) {
    const org = await Organization.create({
      name: orgSeed.name,
      shortName: orgSeed.shortName,
      welcomeMessage: orgSeed.welcomeMessage,
      serviceName: orgSeed.serviceName,
      counterLabel: orgSeed.counterLabel,
      colors: { primary: "#5B2A86", background: "#FFF8DC" },
      restrictRegistrationByDomain: true,
      allowedEmailDomains: ALLOWED_DOMAINS[orgSeed.shortName] ?? [],
    });

    // The admin is seeded into the primary organization only.
    if (orgSeed.shortName === "KNH") {
      await User.create({
        organization: org._id,
        role: "ADMIN",
        name: ADMIN_SEED.name,
        email: ADMIN_SEED.email,
        passwordHash: await hashPassword(ADMIN_SEED.password),
      });
    }

    const staffUsers = [];
    for (const s of orgSeed.staff) {
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

    for (const t of orgSeed.tellers) {
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
    console.log(
      `[seed] ${org.name} (${org.shortName}) — ` +
        `${staffUsers.length} staff, ${orgSeed.tellers.length} tellers, ` +
        `registration domains: ${(ALLOWED_DOMAINS[orgSeed.shortName] ?? []).join(", ")}`,
    );
  }

  // eslint-disable-next-line no-console
  console.log(`
[seed] Admin:   ${ADMIN_SEED.email} / ${ADMIN_SEED.password}
[seed] Staff:   ${ORG_SEEDS[0]?.staff.map((s) => s.email).join(", ")} / ${ORG_SEEDS[0]?.staff[0]?.password}
[seed] Public sign-up is currently limited to gmail.com addresses.
[seed] NOTE: 2FA is not enabled on seeded accounts. On first login each user
       will be asked to enroll an authenticator app before receiving a token.
`);
}
