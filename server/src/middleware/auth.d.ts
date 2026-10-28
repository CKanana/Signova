import type { NextFunction, Request, Response } from "express";
import { type AccessTokenPayload } from "../utils/jwt.js";
import type { Role } from "../../../shared/types/translation.js";
declare global {
    namespace Express {
        interface Request {
            auth?: AccessTokenPayload;
        }
    }
}
/** Require a valid full-scope access token. Attaches req.auth on success. */
export declare function requireAuth(req: Request, _res: Response, next: NextFunction): void;
/** Require one of the given roles. Must run after requireAuth. */
export declare function requireRole(...roles: Role[]): (req: Request, _res: Response, next: NextFunction) => void;
/**
 * Ensure the authenticated user belongs to the organization of the resource.
 * The orgId always comes from the signed token, never from the request.
 */
export declare function assertSameOrg(resourceOrgId: string, req: Request): void;
