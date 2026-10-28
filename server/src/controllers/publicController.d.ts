import type { Request, Response } from "express";
/**
 * Public endpoints consumed by the Deaf-user mobile kiosk. These are
 * intentionally unauthenticated so a first-time device can load branding and
 * the teller list BEFORE a session (and therefore a device token) exists.
 * They expose only non-sensitive configuration data, scoped to one org.
 */
export declare function publicOrgHandler(_req: Request, res: Response): Promise<void>;
export declare function publicTellersHandler(_req: Request, res: Response): Promise<void>;
