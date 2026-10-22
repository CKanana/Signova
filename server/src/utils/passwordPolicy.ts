/** Shared Signova password policy. */

export const PASSWORD_MIN_LENGTH = 12;
export const PASSWORD_REQUIRE_UPPERCASE = true;
export const PASSWORD_REQUIRE_LOWERCASE = true;
export const PASSWORD_REQUIRE_NUMBER = true;
export const PASSWORD_REQUIRE_SPECIAL = true;
export const PASSWORD_ALLOWED_SPECIAL = "!@#$%&";

const SPECIAL_SET = new Set(PASSWORD_ALLOWED_SPECIAL.split(""));

export interface PasswordPolicyResult {
  valid: boolean;
  reasons: string[];
}

export function validatePasswordPolicy(password: string): PasswordPolicyResult {
  const reasons: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    reasons.push(`At least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (PASSWORD_REQUIRE_UPPERCASE && !/[A-Z]/.test(password)) {
    reasons.push("At least one uppercase letter");
  }
  if (PASSWORD_REQUIRE_LOWERCASE && !/[a-z]/.test(password)) {
    reasons.push("At least one lowercase letter");
  }
  if (PASSWORD_REQUIRE_NUMBER && !/[0-9]/.test(password)) {
    reasons.push("At least one number");
  }
  if (PASSWORD_REQUIRE_SPECIAL && ![...password].some((ch) => SPECIAL_SET.has(ch))) {
    reasons.push(`At least one special symbol (${PASSWORD_ALLOWED_SPECIAL})`);
  }
  if (password !== password.trim()) {
    reasons.push("No leading or trailing spaces allowed");
  }

  return {
    valid: reasons.length === 0,
    reasons,
  };
}

export function assertPasswordPolicy(password: string): void {
  const result = validatePasswordPolicy(password);
  if (!result.valid) {
    throw new Error(`Password does not meet policy: ${result.reasons.join(", ")}`);
  }
}

export function passwordRequirementsHint(): string {
  return [
    `Minimum ${PASSWORD_MIN_LENGTH} characters`,
    "At least one uppercase letter (A–Z)",
    "At least one lowercase letter (a–z)",
    "At least one number (0–9)",
    `At least one special symbol (${PASSWORD_ALLOWED_SPECIAL})`,
  ].join(", ");
}
