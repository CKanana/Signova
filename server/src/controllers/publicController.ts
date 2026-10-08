import type { Request, Response } from "express";
import { resolveKioskOrganization } from "../services/kioskService.js";
import { listTellers } from "../services/tellerService.js";

/**
 * Public endpoints consumed by the Deaf-user mobile kiosk. These are
 * intentionally unauthenticated so a first-time device can load branding and
 * the teller list BEFORE a session (and therefore a device token) exists.
 * They expose only non-sensitive configuration data, scoped to one org.
 */

export async function publicOrgHandler(_req: Request, res: Response): Promise<void> {
  const org = await resolveKioskOrganization();
  res.json({ organization: org });
}

export async function publicTellersHandler(_req: Request, res: Response): Promise<void> {
  const org = await resolveKioskOrganization();
  const tellers = await listTellers(org._id.toString());
  res.json({ organizationId: org._id.toString(), tellers });
}