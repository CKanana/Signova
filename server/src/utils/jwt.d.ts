import type { Role } from "../../../shared/types/translation.js";
export type TokenScope = "full" | "2fa" | "mfa_enroll";
export interface AccessTokenPayload {
    sub: string;
    orgId: string;
    role: Role;
    scope: TokenScope;
}
export interface ChallengeTokenPayload {
    sub: string;
    scope: "2fa" | "mfa_enroll";
}
export declare function signAccessToken(payload: Omit<AccessTokenPayload, "scope">): string;
export declare function signChallengeToken(userId: string, scope: "2fa" | "mfa_enroll"): string;
export declare function verifyAccessToken(token: string): AccessTokenPayload;
export declare function verifyChallengeToken(token: string): ChallengeTokenPayload;
