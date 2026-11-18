import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";
import type { MessageSender } from "../../../shared/types/translation.js";

/**
 * Animation object attached to a message when the text-to-ASL animation
 * pipeline (the independent SignBridge service) completes for it.
 *
 * `status` is "pending" | "ready" | "failed" | "skipped" | "retry".
 * `pending` -> generating; `ready` -> generated; `failed` -> generation
 * failed (or timed out/circuit-open); `skipped` -> no video needed (empty,
 * too long, or sent by the Deaf user); `retry` -> a manual retry was
 * requested.
 *
 * Every field is nullable so documents created before this field was added
 * keep working (they simply omit it).
 */
export interface IAnimation {
  status: "pending" | "ready" | "failed" | "skipped" | "retry";
  url: string | null;
  durationMs: number | null;
  requestedAt: Date | null;
  readyAt: Date | null;
  error: string | null;
}

export interface IMessage {
  _id: Schema.Types.ObjectId;
  session: Schema.Types.ObjectId;
  organization: Schema.Types.ObjectId;
  sender: MessageSender;
  text: string;
  method: string;
  confidence?: number;
  isConfirmed: boolean;
  timestamp: Date;
  /** Animation attachment for this message (Phase 2). Nullable for old docs. */
  animation: IAnimation | null;
  toJSON(): Record<string, unknown>;
  save(): Promise<IMessage>;
}

const animationSchema = new Schema<IAnimation>(
  {
    status: {
      type: String,
      enum: ["pending", "ready", "failed", "skipped", "retry"],
      default: "pending",
    },
    url: { type: String, default: null },
    durationMs: { type: Number, default: null },
    requestedAt: { type: Date, default: null },
    readyAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  { _id: false },
);

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
    /** Animation attachment for this message (Phase 2). Nullable for old docs. */
    animation: { type: animationSchema, default: null },
  },
  { timestamps: false },
);

export const Message = mongoose.models?.Message || mongoose.model<IMessage>("Message", messageSchema);
export type MessageModel = Model<IMessage>;
