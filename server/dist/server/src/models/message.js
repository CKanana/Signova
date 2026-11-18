import mongoose, { Schema } from "mongoose";
const animationSchema = new Schema({
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
}, { _id: false });
const messageSchema = new Schema({
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
}, { timestamps: false });
export const Message = mongoose.models?.Message || mongoose.model("Message", messageSchema);
