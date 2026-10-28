import type { Types } from "mongoose";
import type { Role } from "../../../../shared/types/translation.js";
/** Input shape for creating a new staff invitation. */
export interface CreateInvitationInput {
    name: string;
    email: string;
}
/** Shape returned by createInvitation. */
export interface InvitationResult {
    id: string;
    name: string;
    email: string;
    role: Role;
    invitationId: string;
    expiresAt: Date;
}
export declare function createInvitation(orgId: string | Types.ObjectId, invitedBy: string | Types.ObjectId, data: CreateInvitationInput, req: import("express").Request): Promise<InvitationResult>;
export declare function acceptInvitation(rawToken: string, req: import("express").Request): Promise<{
    user: import("mongoose").Document<unknown, {}, import("../../models/user.js").IUser, {}, {}> & import("../../models/user.js").IUser & Required<{
        _id: import("mongoose").Schema.Types.ObjectId;
    }> & {
        __v: number;
    };
    invitation: import("mongoose").Document<unknown, {}, import("../../models/invitation.js").IInvitation, {}, {}> & import("../../models/invitation.js").IInvitation & Required<{
        _id: import("mongoose").Schema.Types.ObjectId;
    }> & {
        __v: number;
    };
}>;
/** Re-send the setup email for a pending staff invitation. */
export declare function resendInvitation(orgId: string | Types.ObjectId, userId: string, email: string, req: import("express").Request): Promise<{
    id: string;
    name: string;
    email: string | undefined;
    role: "STAFF";
    invitationId: string;
    expiresAt: Date;
}>;
