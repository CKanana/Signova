import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";

export interface IPasswordResetToken {
  _id: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  /** sha256 hash of the random reset token. The raw token is never stored. */
  tokenHash: string;
  expiresAt: Date;
  /** Set when the token is successfully redeemed (one-time use). */
  usedAt?: Date;
  createdAt: Date;
}

const passwordResetTokenSchema = new Schema<IPasswordResetToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// TTL index removes expired documents automatically. This is housekeeping
// only — expiration is ALWAYS also enforced explicitly in the validation
// logic (see authService.redeemResetToken), never relied upon here.
passwordResetTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken: Model<IPasswordResetToken> =
  mongoose.models.PasswordResetToken ??
  mongoose.model<IPasswordResetToken>("PasswordResetToken", passwordResetTokenSchema);
