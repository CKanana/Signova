import { getOrganization, updateOrganization, listActiveOrganizations } from "../services/organizationService.js";
import { recordAudit } from "../services/auditService.js";
export async function getOrgHandler(req, res) {
    const org = await getOrganization(req.auth.orgId);
    res.json({ organization: org });
}
/**
 * Public organization list for the staff registration dropdown.
 * Unauthenticated on purpose (no account exists yet), but exposes only
 * each organization's id and name — no configuration, colors, or policy.
 */
export async function listPublicOrganizationsHandler(_req, res) {
    const organizations = await listActiveOrganizations();
    res.json({ organizations });
}
export async function updateOrgHandler(req, res) {
    const org = await updateOrganization(req.auth.orgId, req.body);
    await recordAudit({ action: "ORG_UPDATE", actor: req.auth.sub, organization: req.auth.orgId, req });
    res.json({ organization: org });
}
//# sourceMappingURL=organizationController.js.map