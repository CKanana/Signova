import { Schema } from "mongoose";
import type { Model } from "mongoose";
export interface ISessionLogEvent {
    type: string;
    at: Date;
    meta?: Record<string, unknown>;
}
export interface ISessionLog {
    _id: Schema.Types.ObjectId;
    session: Schema.Types.ObjectId;
    organization: Schema.Types.ObjectId;
    events: ISessionLogEvent[];
    latencyMs: number[];
    stats: {
        translationCount: number;
        avgConfidence: number;
        retryCount: number;
        durationMs: number;
    };
    createdAt: Date;
    updatedAt: Date;
}
export declare const SessionLog: Model<ISessionLog>;
