import { Schema } from "mongoose";
import type { Model } from "mongoose";
import type { MessageSender } from "../../../shared/types/translation.js";
export interface IMessage {
    _id: Schema.Types.ObjectId;
    session: Schema.Types.ObjectId;
    organization: Schema.Types.ObjectId;
    sender: MessageSender;
    text: string;
    method: "sign" | "text" | "speech";
    confidence?: number;
    isConfirmed: boolean;
    timestamp: Date;
}
export declare const Message: Model<IMessage>;
