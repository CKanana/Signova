import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";

export interface IRefreshToken {
  _id: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<IRefreshToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export const RefreshToken: Model<IRefreshToken> =
  mongoose.models.RefreshToken ?? mongoose.model<IRefreshToken>("RefreshToken", refreshTokenSchema);
