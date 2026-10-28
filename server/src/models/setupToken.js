import mongoose, { Schema } from "mongoose";
const setupTokenSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true },
    scope: { type: String, enum: ["bootstrap", "password_setup"], required: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date },
}, { timestamps: true });
setupTokenSchema.index({ tokenHash: 1 }, { unique: true });
export const SetupToken = mongoose.models.SetupToken ?? mongoose.model("SetupToken", setupTokenSchema);
//# sourceMappingURL=setupToken.js.map