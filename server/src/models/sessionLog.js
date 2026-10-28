import mongoose, { Schema } from "mongoose";
const sessionLogSchema = new Schema({
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
}, { timestamps: true });
export const SessionLog = mongoose.models.SessionLog ?? mongoose.model("SessionLog", sessionLogSchema);
//# sourceMappingURL=sessionLog.js.map