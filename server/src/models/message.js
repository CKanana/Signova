import mongoose, { Schema } from "mongoose";
const messageSchema = new Schema({
    session: { type: Schema.Types.ObjectId, ref: "Session", required: true, index: true },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    sender: { type: String, enum: ["USER", "STAFF"], required: true },
    text: { type: String, required: true },
    method: { type: String, enum: ["sign", "text", "speech"], required: true },
    confidence: { type: Number, min: 0, max: 1 },
    isConfirmed: { type: Boolean, default: false },
    timestamp: { type: Date, default: () => new Date() },
}, { timestamps: false });
messageSchema.index({ session: 1, timestamp: 1 });
export const Message = mongoose.models.Message ?? mongoose.model("Message", messageSchema);
//# sourceMappingURL=message.js.map