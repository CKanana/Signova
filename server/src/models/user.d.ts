import { Schema } from "mongoose";
import type { Model } from "mongoose";
import type { Role } from "../../../shared/types/translation.js";
export interface IUser {
    _id: Schema.Types.ObjectId;
    organization: Schema.Types.ObjectId;
    role: Role;
    name: string;
    email?: string;
    phone?: string;
    avatar?: string;
    passwordHash?: string;
    totpSecret?: string;
    /**
     * The absolute TOTP time-step of the last accepted code. A code whose
     * step was already used is rejected, so a captured code cannot be
     * replayed within the verification window. Updated atomically in the
     * same operation that claims the step (see authService.claimTotpStep).
     */
    totpLastUsedStep?: number;
    twoFactorEnabled: boolean;
    twoFactorConfirmedAt?: Date;
    failedLoginCount: number;
    lockedUntil?: Date;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const User: Model<IUser>;
