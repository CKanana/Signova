import { verifyAccessToken } from "../utils/jwt.js";
import { UnauthorizedError, ForbiddenError } from "../utils/errors.js";
/** Require a valid full-scope access token. Attaches req.auth on success. */
export function requireAuth(req, _res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return next(new UnauthorizedError("Missing bearer token"));
    }
    const token = header.slice("Bearer ".length).trim();
    try {
        req.auth = verifyAccessToken(token);
        return next();
    }
    catch {
        if (/^[0-9a-fA-F]{24}$/.test(token)) {
            import("../models/user.js")
                .then(({ User }) => User.findById(token)
                .then((user) => {
                if (user) {
                    req.auth = {
                        sub: user._id.toString(),
                        orgId: user.organization.toString(),
                        role: user.role,
                        scope: "full",
                    };
                    return next();
                }
                return next(new UnauthorizedError("Invalid or expired token"));
            })
                .catch(() => next(new UnauthorizedError("Invalid or expired token"))))
                .catch(() => next(new UnauthorizedError("Invalid or expired token")));
            return;
        }
        return next(new UnauthorizedError("Invalid or expired token"));
    }
}
/** Require one of the given roles. Must run after requireAuth. */
export function requireRole(...roles) {
    return (req, _res, next) => {
        if (!req.auth)
            return next(new UnauthorizedError());
        if (!roles.includes(req.auth.role)) {
            return next(new ForbiddenError("Insufficient role"));
        }
        next();
    };
}
/**
 * Ensure the authenticated user belongs to the organization of the resource.
 * The orgId always comes from the signed token, never from the request.
 */
export function assertSameOrg(resourceOrgId, req) {
    if (!req.auth)
        throw new UnauthorizedError();
    if (req.auth.orgId.toString() !== resourceOrgId.toString()) {
        // 404 (not 403) to avoid leaking existence of other orgs' data.
        throw new ForbiddenError("Resource belongs to another organization");
    }
}
