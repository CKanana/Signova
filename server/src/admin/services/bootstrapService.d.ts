export interface AcceptBootstrapInput {
    token: string;
    password: string;
}
export interface AcceptBootstrapResult {
    status: "mfa_enroll_required";
    challengeToken: string;
    user: {
        id: string;
        name: string;
        email?: string;
    };
}
export interface ActivateBootstrapInput {
    challengeToken: string;
    code: string;
}
export interface ActivateBootstrapResult {
    status: "active";
    accessToken: string;
    refreshToken: string;
    user: {
        id: string;
        name: string;
        email?: string;
        role: "ADMIN";
        twoFactorEnabled: boolean;
        isActive: boolean;
    };
}
export declare function acceptBootstrap(input: AcceptBootstrapInput): Promise<AcceptBootstrapResult>;
export declare function activateBootstrap(input: ActivateBootstrapInput): Promise<ActivateBootstrapResult>;
