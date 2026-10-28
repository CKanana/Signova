import { Schema } from "mongoose";
import type { Model } from "mongoose";
import type { CommunicationMethod, SessionEndReason, SessionStatus } from "../../../shared/types/translation.js";
export interface ISession {
    _id: Schema.Types.ObjectId;
    organization: Schema.Types.ObjectId;
    teller: Schema.Types.ObjectId;
    deafUser: Schema.Types.ObjectId;
    method: CommunicationMethod;
    status: SessionStatus;
    pairingCode: string;
    startedAt: Date;
    endedAt?: Date;
    endReason?: SessionEndReason;
    messageCount: number;
    isRecorded: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Session: Model<ISession>;
