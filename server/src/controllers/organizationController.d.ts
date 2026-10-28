import type { Request, Response } from "express";
export declare function getOrgHandler(req: Request, res: Response): Promise<void>;
/**
 * Public organization list for the staff registration dropdown.
 * Unauthenticated on purpose (no account exists yet), but exposes only
 * each organization's id and name — no configuration, colors, or policy.
 */
export declare function listPublicOrganizationsHandler(_req: Request, res: Response): Promise<void>;
export declare function updateOrgHandler(req: Request, res: Response): Promise<void>;
