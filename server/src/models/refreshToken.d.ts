import { Schema } from "mongoose";
import type { Model } from "mongoose";
export interface IRefreshToken {
    _id: Schema.Types.ObjectId;
    user: Schema.Types.ObjectId;
    tokenHash: string;
    expiresAt: Date;
    revokedAt?: Date;
    createdAt: Date;
}
export declare const RefreshToken: Model<IRefreshToken>;
