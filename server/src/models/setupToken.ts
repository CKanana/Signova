import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";

export interface ISetupToken {
  _id: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  tokenHash: string;
  scope: "bootstrap" | "password_setup";
  expiresAt: Date;
  usedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const setupTokenSchema = new Schema<ISetupToken>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true },
    scope: { type: String, enum: ["bootstrap", "password_setup"], required: true },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date },
  },
  { timestamps: true },
);

setupTokenSchema.index({ tokenHash: 1 }, { unique: true });

export const SetupToken: Model<ISetupToken> =
  mongoose.models.SetupToken ?? mongoose.model<ISetupToken>("SetupToken", setupTokenSchema);
