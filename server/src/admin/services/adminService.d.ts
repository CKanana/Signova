import type { Types } from "mongoose";
import type { Role, TellerStatus, AdminUserSummary } from "../../../../shared/types/translation.js";
/** Admin service — org-scoped queries and mutations. */
export declare function getOrganization(orgId: string | Types.ObjectId): Promise<import("mongoose").Document<unknown, {}, import("../../models/organization.js").IOrganization, {}, {}> & import("../../models/organization.js").IOrganization & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function listStaff(orgId: string | Types.ObjectId, opts?: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: "STAFF" | "ADMIN";
    onlyActive?: boolean;
    onlyInactive?: boolean;
    onlyPending?: boolean;
}): Promise<{
    items: AdminUserSummary[];
    total: number;
}>;
export declare function getStaff(orgId: string | Types.ObjectId, userId: string): Promise<AdminUserSummary | null>;
export declare function createStaff(orgId: string | Types.ObjectId, data: {
    name: string;
    email: string;
    phone?: string;
    role: Role;
}, currentUserId: string, req: import("express").Request): Promise<{
    user: import("mongoose").Document<unknown, {}, import("../../models/user.js").IUser>;
    invitation?: import("../services/invitationService.js").InvitationResult;
}>;
export declare function updateStaff(orgId: string | Types.ObjectId, userId: string, updates: Partial<{
    name: string;
    email: string;
    phone: string;
    role: Role;
}>, currentUserId: string, req: import("express").Request): Promise<AdminUserSummary>;
export declare function setStaffActive(orgId: string | Types.ObjectId, userId: string, active: boolean, currentUserId: string, req: import("express").Request): Promise<AdminUserSummary>;
export declare function resetStaff2FA(orgId: string | Types.ObjectId, userId: string, currentUserId: string, req: import("express").Request): Promise<void>;
export declare function recordAdminAudit(action: string, organization: unknown, actor: unknown, target?: string, req?: import("express").Request): Promise<void>;
export declare function listTellers(orgId: string | Types.ObjectId): Promise<{
    items: (import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller, {}, {}> & import("../../models/teller.js").ITeller & Required<{
        _id: import("mongoose").Schema.Types.ObjectId;
    }> & {
        __v: number;
    })[];
    total: number;
}>;
export declare function getTeller(orgId: string | Types.ObjectId, tellerId: string): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller, {}, {}> & import("../../models/teller.js").ITeller & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function createTeller(orgId: string | Types.ObjectId, data: {
    name: string;
    serviceLabel?: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser?: string;
    pairingCode?: string;
}, currentUserId: string, req: import("express").Request): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>>;
export declare function updateTeller(orgId: string | Types.ObjectId, tellerId: string, updates: Partial<{
    name: string;
    serviceLabel: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser: string;
}>, currentUserId: string, req: import("express").Request): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>>;
export declare function setTellerStatus(orgId: string | Types.ObjectId, tellerId: string, status: TellerStatus, currentUserId: string, req: import("express").Request): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>>;
export declare function assignStaffToTeller(orgId: string | Types.ObjectId, tellerId: string, staffUserId: string, currentUserId: string, req: import("express").Request): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>>;
export declare function listSessions(orgId: string | Types.ObjectId, opts: {
    tellerId?: string;
    status?: string;
    page?: number;
    pageSize?: number;
}): Promise<{
    items: import("mongoose").Document<unknown, {}, import("../../models/session.js").ISession>[];
    total: number;
}>;
export declare function getSession(orgId: string | Types.ObjectId, sessionId: string): Promise<import("mongoose").Document<unknown, {}, import("../../models/session.js").ISession, {}, {}> & import("../../models/session.js").ISession & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
export declare function listAuditLogs(orgId: string | Types.ObjectId, opts: {
    action?: string;
    actor?: string;
    target?: string;
    page?: number;
    pageSize?: number;
}): Promise<{
    items: import("mongoose").Document<unknown, {}, import("../../models/auditLog.js").IAuditLog>[];
    total: number;
}>;
