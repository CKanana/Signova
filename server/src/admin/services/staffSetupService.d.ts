export interface AcceptStaffSetupInput {
    token: string;
    password: string;
}
export interface AcceptStaffSetupResult {
    status: "mfa_enroll_required";
    challengeToken: string;
    user: {
        id: string;
        name: string;
        email?: string;
    };
}
export declare function acceptStaffSetup(input: AcceptStaffSetupInput): Promise<AcceptStaffSetupResult>;
export declare function activateStaffSetup(challengeToken: string, code: string): Promise<{
    status: string;
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        name: string;
        email: string | undefined;
        role: "STAFF";
        twoFactorEnabled: boolean;
        isActive: boolean;
    };
}>;
