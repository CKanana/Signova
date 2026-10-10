import { Organization } from "../models/organization.js";
import { NotFoundError } from "../utils/errors.js";
import type { Types } from "mongoose";

export async function getOrganization(orgId: string | Types.ObjectId) {
  const org = await Organization.findById(orgId);
  if (!org) throw new NotFoundError("Organization not found");
  return org;
}

/**
 * Active organizations for the public registration dropdown.
 * Exposes ONLY id + name — never colors, policy, or any other config.
 */
export async function listActiveOrganizations() {
  return Organization.find({ isActive: true }).select("_id name").sort({ name: 1 });
}

export async function updateOrganization(
  orgId: string | Types.ObjectId,
  updates: Partial<{
    name: string;
    shortName: string;
    welcomeMessage: string;
    serviceName: string;
    counterLabel: string;
    colors: { primary: string; background: string };
    logoUrl: string;
  }>,
) {
  const org = await Organization.findByIdAndUpdate(orgId, updates, { new: true });
  if (!org) throw new NotFoundError("Organization not found");
  return org;
}
