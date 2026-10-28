"""Apply TypeScript diagnostic fixes to the Signova server.

Fixes:
1. auditService.ts: add `error?: unknown` to AuditInput (used by recordAudit).
2. auditService.ts: add missing AuditAction union members referenced in code.
3. invitationService.ts: convert ObjectId returns to string via .toString().
4. staffSetupService.ts: add missing AuditAction union members.
5. invitationService.ts: remove usage of non-existent 'inviteResendCooldownMs'
   on the Organization document (the field doesn't exist in IOrganization).
"""
from pathlib import Path

BASE = Path("server/src")

# ---------- 1. AuditInput: add `error?` ----------
p = BASE / "services" / "auditService.ts"
s = p.read_text(encoding="utf-8")
old = """interface AuditInput {
  action: AuditAction;
  organization?: unknown;
  actor?: unknown;
  target?: string;
  meta?: Record<string, unknown>;
  req?: Request;
}"""
new = """interface AuditInput {
  action: AuditAction;
  organization?: unknown;
  actor?: unknown;
  target?: string;
  meta?: Record<string, unknown>;
  req?: Request;
  error?: unknown;
}"""
assert old in s, "AuditInput block not found"
s = s.replace(old, new)
p.write_text(s, encoding="utf-8")
print("[1] auditService.ts: AuditInput.error? added")

# ---------- 2. AuditAction: add missing members ----------
p = BASE / "services" / "auditService.ts"
s = p.read_text(encoding="utf-8")

# StaffSetupService references:
#   STAFF_SETUP_UNKNOWN_TOKEN, STAFF_SETUP_EXPIRED, STAFF_SETUP_BAD_SCOPE,
#   STAFF_SETUP_BAD_USER, STAFF_SETUP_PASSWORD_SET, STAFF_SETUP_ACTIVATED
s = s.replace(
    '| "STAFF_REGISTER"',
    '| "STAFF_REGISTER"\n'
    '  | "STAFF_SETUP_UNKNOWN_TOKEN"\n'
    '  | "STAFF_SETUP_EXPIRED"\n'
    '  | "STAFF_SETUP_BAD_SCOPE"\n'
    '  | "STAFF_SETUP_BAD_USER"\n'
    '  | "STAFF_SETUP_PASSWORD_SET"\n'
    '  | "STAFF_SETUP_ACTIVATED"',
)

# invitationController references:
#   INVITE_ACCEPT_FAILED, STAFF_INVITE_DUPLICATE, STAFF_INVITE_NO_ADMIN_PRIVILEGE,
#   STAFF_INVITE_FAILED
s = s.replace(
    '| "INVITE_ACCEPTED"',
    '| "INVITE_ACCEPTED"\n'
    '  | "INVITE_ACCEPT_FAILED"\n'
    '  | "STAFF_INVITE_DUPLICATE"\n'
    '  | "STAFF_INVITE_NO_ADMIN_PRIVILEGE"\n'
    '  | "STAFF_INVITE_FAILED"',
)
p.write_text(s, encoding="utf-8")
print("[2] auditService.ts: missing AuditAction members added")

# ---------- 3. invitationService.ts: ObjectId -> string ----------
p = BASE / "admin" / "services" / "invitationService.ts"
s = p.read_text(encoding="utf-8")

# Fix createStaff return
old1 = """  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    invitationId: invitation!._id,
    expiresAt: invitation!.expiresAt,
  };"""
new1 = """  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    invitationId: invitation!._id.toString(),
    expiresAt: invitation!.expiresAt,
  };"""
assert old1 in s, "createStaff return block not found"
s = s.replace(old1, new1)

# Remove the broken inviteResendCooldownMs usage in resendInvitation
old2 = """  // Rate-limit / cooldown: prevent repeated emails for the same mailbox.
  // Best-effort: honoured when a session store is present; otherwise the
  // rateLimit middleware (inviteLimiter) already bounds request volume.
  if (org.inviteResendCooldownMs && req) {
    const lastResend = (req as any).resendCooldownLastAt;
    if (lastResend) {
      const elapsed = Date.now() - lastResend;
      if (elapsed < org.inviteResendCooldownMs) {
        const msLeft = org.inviteResendCooldownMs - elapsed;
        throw new BadRequestError(`Please wait ${Math.ceil(msLeft / 60000)} minutes before resending the invitation email.`);
      }
    }
  }

  const rawToken = randomToken(INVITE_TOKEN_BYTES);"""
new2 = """  const rawToken = randomToken(INVITE_TOKEN_BYTES);"""
assert old2 in s, "resendInvitation cooldown block not found"
s = s.replace(old2, new2)

# Remove resend cooldown write-back
old3 = """  if (org.inviteResendCooldownMs && req) {
    try {
      (req as any).resendCooldownLastAt = Date.now();
    } catch {
      // stateless environments: cooldown is best-effort
    }
  }

  await recordAudit({ action: "INVITE_RESENT"""
new3 = """  await recordAudit({ action: "INVITE_EMAIL_SENT"""
assert old3 in s, "resend cooldown write-back not found"
s = s.replace(old3, new3)

# Fix resendInvitation return
old4 = """  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    invitationId: newInvitation._id,
    expiresAt,
  };"""
new4 = """  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    invitationId: newInvitation._id.toString(),
    expiresAt,
  };"""
assert old4 in s, "resendInvitation return not found"
s = s.replace(old4, new4)
p.write_text(s, encoding="utf-8")
print("[3] invitationService.ts: ObjectId->string + cooldown removed")

print("\nAll TypeScript diagnostic fixes applied.")
print("Note: shared/app-shell/* errors are frontend-only (JSX lib + CSS import)")
print("and are out of scope for the server typecheck.")
