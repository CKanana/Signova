import mongoose, { Schema } from "mongoose";
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

const sessionLogSchema = new Schema<ISessionLog>(
  {
    session: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    events: [
      {
        type: { type: String, required: true },
        at: { type: Date, default: () => new Date() },
        meta: { type: Schema.Types.Mixed },
      },
    ],
    latencyMs: [{ type: Number }],
    stats: {
      translationCount: { type: Number, default: 0 },
      avgConfidence: { type: Number, default: 0 },
      retryCount: { type: Number, default: 0 },
      durationMs: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

export const SessionLog: Model<ISessionLog> =
  mongoose.models.SessionLog ?? mongoose.model<ISessionLog>("SessionLog", sessionLogSchema);
