import { Organization } from "../models/organization.js";
import { NotFoundError } from "../utils/errors.js";
import { config } from "../config/env.js";

/**
 * Resolve the organization served to mobile kiosks.
 * Pinned via SIGNOVA_ORG_ID when set; otherwise the first active organization.
 */
export async function resolveKioskOrganization() {
  if (config.orgId) {
    const org = await Organization.findById(config.orgId);
    if (org) return org;
  }
  const org = await Organization.findOne({ isActive: true }).sort({ createdAt: 1 });
  if (!org) throw new NotFoundError("No organization configured");
  return org;
}
