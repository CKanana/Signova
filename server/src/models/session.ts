import mongoose, { Schema } from "mongoose";
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

const sessionSchema = new Schema<ISession>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    teller: { type: Schema.Types.ObjectId, ref: "Teller", required: true },
    deafUser: { type: Schema.Types.ObjectId, ref: "User", required: true },
    method: { type: String, enum: ["sign", "text"], required: true },
    status: { type: String, enum: ["CONNECTING", "ACTIVE", "ENDED"], default: "CONNECTING" },
    pairingCode: { type: String, required: true },
    startedAt: { type: Date, default: () => new Date() },
    endedAt: { type: Date },
    endReason: { type: String, enum: ["USER_ENDED", "STAFF_ENDED", "TIMEOUT", "ERROR"] },
    messageCount: { type: Number, default: 0 },
    isRecorded: { type: Boolean, default: true },
  },
  { timestamps: true },
);

sessionSchema.index({ organization: 1, status: 1 });
sessionSchema.index({ teller: 1, status: 1 });
sessionSchema.index({ organization: 1, createdAt: -1 });

export const Session: Model<ISession> = mongoose.models.Session ?? mongoose.model<ISession>("Session", sessionSchema);
