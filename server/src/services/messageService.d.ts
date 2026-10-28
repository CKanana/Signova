import type { Types } from "mongoose";
import type { MessageSender } from "../../../shared/types/translation.js";
export declare function listMessages(orgId: Types.ObjectId | string, sessionId: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/message.js").IMessage, {}, {}> & import("../models/message.js").IMessage & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
})[]>;
export declare function sendMessage(orgId: Types.ObjectId | string, sessionId: string, input: {
    sender: MessageSender;
    text: string;
    method: "sign" | "text" | "speech";
    confidence?: number;
    isConfirmed?: boolean;
}): Promise<import("mongoose").Document<unknown, {}, import("../models/message.js").IMessage, {}, {}> & import("../models/message.js").IMessage & Required<{
    _id: import("mongoose").Schema.Types.ObjectId;
}> & {
    __v: number;
}>;
