import { Organization } from "../models/organization.js";
import { NotFoundError } from "../utils/errors.js";
export async function getOrganization(orgId) {
    const org = await Organization.findById(orgId);
    if (!org)
        throw new NotFoundError("Organization not found");
    return org;
}
/**
 * Active organizations for the public registration dropdown.
 * Exposes ONLY id + name — never colors, policy, or any other config.
 */
export async function listActiveOrganizations() {
    return Organization.find({ isActive: true }).select("_id name").sort({ name: 1 });
}
export async function updateOrganization(orgId, updates) {
    const org = await Organization.findByIdAndUpdate(orgId, updates, { new: true });
    if (!org)
        throw new NotFoundError("Organization not found");
    return org;
}
//# sourceMappingURL=organizationService.js.map