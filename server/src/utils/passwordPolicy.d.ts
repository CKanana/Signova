/** Shared Signova password policy. */
export declare const PASSWORD_MIN_LENGTH = 12;
export declare const PASSWORD_REQUIRE_UPPERCASE = true;
export declare const PASSWORD_REQUIRE_LOWERCASE = true;
export declare const PASSWORD_REQUIRE_NUMBER = true;
export declare const PASSWORD_REQUIRE_SPECIAL = true;
export declare const PASSWORD_ALLOWED_SPECIAL = "!@#$%&";
export interface PasswordPolicyResult {
    valid: boolean;
    reasons: string[];
}
export declare function validatePasswordPolicy(password: string): PasswordPolicyResult;
export declare function assertPasswordPolicy(password: string): void;
export declare function passwordRequirementsHint(): string;
