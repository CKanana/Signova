import "dotenv/config";
export declare const config: {
    readonly env: "development" | "test" | "production";
    readonly isProduction: boolean;
    readonly port: number;
    readonly corsOrigins: string[];
    readonly mongodbUri: string;
    readonly jwt: {
        readonly accessSecret: string;
        readonly accessTtl: string;
        readonly refreshSecret: string;
        readonly refreshTtl: string;
        readonly challengeSecret: string;
        readonly challengeTtl: string;
    };
    readonly totpEncryptionKey: string;
    readonly appName: string;
    readonly lowConfidenceThreshold: number;
    readonly orgId: string | undefined;
    readonly smtp: {
        readonly host: string;
        readonly port: number;
        readonly user: string | undefined;
        readonly appPassword: string | undefined;
    };
    readonly adminPortalUrl: string;
    readonly passwordResetBaseUrl: string;
    readonly appPublicBaseUrl: string;
    readonly passwordResetTtlMinutes: number;
    readonly BOOTSTRAP_SETUP_TOKEN_TTL_MS: number;
};
export declare const BOOTSTRAP_SETUP_TOKEN_TTL_MS: number;
