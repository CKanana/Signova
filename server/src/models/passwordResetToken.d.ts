import { Schema } from "mongoose";
import type { Model } from "mongoose";
export interface IPasswordResetToken {
    _id: Schema.Types.ObjectId;
    user: Schema.Types.ObjectId;
    /** sha256 hash of the random reset token. The raw token is never stored. */
    tokenHash: string;
    expiresAt: Date;
    /** Set when the token is successfully redeemed (one-time use). */
    usedAt?: Date;
    createdAt: Date;
}
export declare const PasswordResetToken: Model<IPasswordResetToken>;
