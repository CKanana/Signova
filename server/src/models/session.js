import mongoose, { Schema } from "mongoose";
const sessionSchema = new Schema({
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
}, { timestamps: true });
sessionSchema.index({ organization: 1, status: 1 });
sessionSchema.index({ teller: 1, status: 1 });
sessionSchema.index({ organization: 1, createdAt: -1 });
export const Session = mongoose.models.Session ?? mongoose.model("Session", sessionSchema);
//# sourceMappingURL=session.js.map