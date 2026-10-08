import mongoose, { Schema } from "mongoose";
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

const messageSchema = new Schema<IMessage>(
  {
    session: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    sender: { type: String, enum: ["USER", "STAFF"], required: true },
    text: { type: String, required: true },
    method: { type: String, enum: ["sign", "text", "speech"], required: true },
    confidence: { type: Number, min: 0, max: 1 },
    isConfirmed: { type: Boolean, default: false },
    timestamp: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

messageSchema.index({ session: 1, timestamp: 1 });

export const Message: Model<IMessage> = mongoose.models.Message ?? mongoose.model<IMessage>("Message", messageSchema);
