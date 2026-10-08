import type { Request } from "express";
import { AuditLog } from "../models/auditLog.js";

export type AuditAction =
  | "LOGIN"
  | "LOGIN_FAILED"
  | "LOGOUT"
  | "OTP_VERIFY"
  | "OTP_VERIFY_FAILED"
  | "PASSWORD_CHANGE"
  | "2FA_ENROLL_START"
  | "2FA_ENROLL_ACTIVATE"
  | "2FA_DISABLE"
  | "2FA_RESET"
  | "STAFF_ACTIVATE"
  | "STAFF_DEACTIVATE"
  | "STAFF_CREATE"
  | "STAFF_UPDATE"
  | "ORG_UPDATE"
  | "TELLER_CREATE"
  | "TELLER_UPDATE";

interface AuditInput {
  action: AuditAction;
  organization?: unknown;
  actor?: unknown;
  target?: string;
  meta?: Record<string, unknown>;
  req?: Request;
}

/**
 * Record a security-relevant event. NEVER pass secrets (passwords, OTP codes,
 * tokens, TOTP secrets) into `meta` — those must never be persisted or logged.
 */
export async function recordAudit(input: AuditInput): Promise<void> {
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
  } catch (err) {
    // Audit failure must never crash the request path; log and continue.
    // eslint-disable-next-line no-console
    console.error("[audit] failed to record event", input.action, (err as Error).message);
  }
}
