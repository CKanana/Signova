import { Schema } from "mongoose";
import type { Model } from "mongoose";
export interface IInvitation {
    _id: Schema.Types.ObjectId;
    user: Schema.Types.ObjectId;
    email: string;
    organization: Schema.Types.ObjectId;
    invitedBy: Schema.Types.ObjectId;
    tokenHash: string;
    status: "pending" | "accepted" | "revoked" | "expired";
    expiresAt: Date;
    acceptedAt?: Date;
    revokedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Invitation: Model<IInvitation>;
