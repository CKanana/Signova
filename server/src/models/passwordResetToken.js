import mongoose, { Schema } from "mongoose";
const passwordResetTokenSchema = new Schema({
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
}, { timestamps: { createdAt: true, updatedAt: false } });
// TTL index removes expired documents automatically. This is housekeeping
// only — expiration is ALWAYS also enforced explicitly in the validation
// logic (see authService.redeemResetToken), never relied upon here.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
export const PasswordResetToken = mongoose.models.PasswordResetToken ??
    mongoose.model("PasswordResetToken", passwordResetTokenSchema);
//# sourceMappingURL=passwordResetToken.js.map