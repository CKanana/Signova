import mongoose, { Schema } from "mongoose";
const auditLogSchema = new Schema({
    organization: { type: Schema.Types.ObjectId, ref: "Organization", index: true, sparse: true },
    actor: { type: Schema.Types.ObjectId, ref: "User", index: true, sparse: true },
    action: { type: String, required: true },
    target: { type: String },
    ip: { type: String },
    userAgent: { type: String },
    meta: { type: Schema.Types.Mixed },
    at: { type: Date, default: () => new Date() },
}, { timestamps: false });
auditLogSchema.index({ organization: 1, at: -1 });
auditLogSchema.index({ actor: 1, at: -1 });
export const AuditLog = mongoose.models.AuditLog ?? mongoose.model("AuditLog", auditLogSchema);
//# sourceMappingURL=auditLog.js.map