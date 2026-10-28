import type { Types } from "mongoose";
export declare function getOrganization(orgId: string | Types.ObjectId): Promise<import("mongoose").Document<unknown, {}, import("../models/organization.js").IOrganization, {}, {}> & import("../models/organization.js").IOrganization & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
/**
 * Active organizations for the public registration dropdown.
 * Exposes ONLY id + name — never colors, policy, or any other config.
 */
export declare function listActiveOrganizations(): Promise<(import("mongoose").Document<unknown, {}, import("../models/organization.js").IOrganization, {}, {}> & import("../models/organization.js").IOrganization & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
})[]>;
export declare function updateOrganization(orgId: string | Types.ObjectId, updates: Partial<{
    name: string;
    shortName: string;
    welcomeMessage: string;
    serviceName: string;
    counterLabel: string;
    colors: {
        primary: string;
        background: string;
    };
    logoUrl: string;
}>): Promise<import("mongoose").Document<unknown, {}, import("../models/organization.js").IOrganization, {}, {}> & import("../models/organization.js").IOrganization & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
