import { Schema } from "mongoose";
import type { Model } from "mongoose";
export interface IOrganization {
    _id: Schema.Types.ObjectId;
    name: string;
    shortName: string;
    welcomeMessage: string;
    serviceName: string;
    counterLabel: string;
    colors: {
        primary: string;
        background: string;
    };
    logoUrl?: string;
    /**
     * Public-registration email-domain policy.
     *
     * When `restrictRegistrationByDomain` is true, public staff registration
     * only accepts emails whose domain appears in `allowedEmailDomains`.
     * When false (the default), that organization accepts any valid email.
     *
     * This governs registration only — it never grants privileges, and role
     * assignment is always decided server-side (public registration is
     * always STAFF, never ADMIN).
     */
    restrictRegistrationByDomain: boolean;
    allowedEmailDomains: string[];
    /**
     * Audit flag for first-administrator bootstrap provisioning outside the
     * normal staff domain policy. One-time use: set only when a bootstrap
     * setup token is issued for the account in `bootstrapAdminEmail`.
     */
    bootstrapAdminEmail?: string;
    bootstrapAdminException: boolean;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Organization: Model<IOrganization>;
