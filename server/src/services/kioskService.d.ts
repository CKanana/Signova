/**
 * Resolve the organization served to mobile kiosks.
 * Pinned via SIGNOVA_ORG_ID when set; otherwise the first active organization.
 */
export declare function resolveKioskOrganization(): Promise<import("mongoose").Document<unknown, {}, import("../models/organization.js").IOrganization, {}, {}> & import("../models/organization.js").IOrganization & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
