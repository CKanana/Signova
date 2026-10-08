import type { Request, Response } from "express";
import { getOrganization, updateOrganization } from "../services/organizationService.js";
import { recordAudit } from "../services/auditService.js";

export async function getOrgHandler(req: Request, res: Response): Promise<void> {
  const org = await getOrganization(req.auth!.orgId);
  res.json({ organization: org });
}

export async function updateOrgHandler(req: Request, res: Response): Promise<void> {
  const org = await updateOrganization(req.auth!.orgId, req.body);
  await recordAudit({ action: "ORG_UPDATE", actor: req.auth!.sub, organization: req.auth!.orgId, req });
  res.json({ organization: org });
}
