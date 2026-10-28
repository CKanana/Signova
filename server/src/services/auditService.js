import { AuditLog } from "../models/auditLog.js";
/**
 * Record a security-relevant event. NEVER pass secrets (passwords, OTP codes,
 * tokens, TOTP secrets) into `meta` — those must never be persisted or logged.
 */
export async function recordAudit(input) {
    try {
        await AuditLog.create({
            action: input.action,
            organization: input.organization,
            actor: input.actor,
            target: input.target,
            meta: input.meta,
            ip: input.req?.ip,
            userAgent: input.req?.headers?.["user-agent"],
        });
    }
    catch (err) {
        // Audit failure must never crash the request path; log and continue.
        // eslint-disable-next-line no-console
        console.error("[audit] failed to record event", input.action, err.message);
    }
}
//# sourceMappingURL=auditService.js.map