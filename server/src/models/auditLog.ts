import mongoose, { Schema } from "mongoose";
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

const auditLogSchema = new Schema<IAuditLog>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", index: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true },
    action: { type: String, required: true },
    target: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    meta: { type: Schema.Types.Mixed },
    at: { type: Date, default: () => new Date() },
  },
  { timestamps: false },
);

auditLogSchema.index({ organization: 1, at: -1 });
auditLogSchema.index({ actor: 1, at: -1 });

export const AuditLog: Model<IAuditLog> =
  mongoose.models.AuditLog ?? mongoose.model<IAuditLog>("AuditLog", auditLogSchema);
