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
  | "STAFF_REGISTER"
  | "STAFF_UPDATE"
  | "PASSWORD_RESET_REQUEST"
  | "PASSWORD_RESET_SUCCESS"
  | "PASSWORD_RESET_FAILED"
  | "ORG_UPDATE"
  | "TELLER_CREATE"
  | "TELLER_UPDATE"
  | "REFRESH_TOKEN_REUSE"
  | "INVITE_CREATED"
  | "INVITE_ACCEPTED"
  | "INVITE_EMAIL_FAILED"
  | "INVITE_ACCEPT_UNKNOWN_TOKEN"
  | "INVITE_ACCEPT_REPLAY"
  | "INVITE_ACCEPT_EXPIRED"
  | "INVITE_ACCEPT_BAD_USER"
  | "BOOTSTRAP_ACCEPT_UNKNOWN"
  | "BOOTSTRAP_ACCEPT_REPLAY"
  | "BOOTSTRAP_ACCEPT_EXPIRED"
  | "BOOTSTRAP_ACCEPT_BAD_SCOPE"
  | "BOOTSTRAP_ACCEPT_BAD_USER"
  | "BOOTSTRAP_ACCEPT_NOT_AUTHORIZED"
  | "BOOTSTRAP_ACCEPT_CONFLICT"
  | "BOOTSTRAP_ACCEPT_WEAK_PASSWORD"
  | "BOOTSTRAP_ACCEPTED"
  | "BOOTSTRAP_ACTIVATED"
  | "BOOTSTRAP_SETUP_EMAIL_SENT";

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
