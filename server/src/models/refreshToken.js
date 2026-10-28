import mongoose, { Schema } from "mongoose";
const refreshTokenSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });
export const RefreshToken = mongoose.models.RefreshToken ?? mongoose.model("RefreshToken", refreshTokenSchema);
//# sourceMappingURL=refreshToken.js.map