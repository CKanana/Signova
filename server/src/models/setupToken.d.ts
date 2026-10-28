import { Schema } from "mongoose";
import type { Model } from "mongoose";
export interface ISetupToken {
    _id: Schema.Types.ObjectId;
    user: Schema.Types.ObjectId;
    tokenHash: string;
    scope: "bootstrap" | "password_setup";
    expiresAt: Date;
    usedAt?: Date;
    createdAt: Date;
    updatedAt: Date;
}
export declare const SetupToken: Model<ISetupToken>;
