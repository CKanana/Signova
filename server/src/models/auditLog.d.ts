import { Schema } from "mongoose";
import type { Model } from "mongoose";
export interface IAuditLog {
    _id: Schema.Types.ObjectId;
    organization?: Schema.Types.ObjectId;
    actor?: Schema.Types.ObjectId;
    action: string;
    target?: string;
    ip?: string;
    userAgent?: string;
    meta?: Record<string, unknown>;
    at: Date;
}
export declare const AuditLog: Model<IAuditLog>;
