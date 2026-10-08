import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";
import type { Role } from "../../../shared/types/translation.js";

export interface IUser {
  _id: Schema.Types.ObjectId;
  organization: Schema.Types.ObjectId;
  role: Role;
  name: string;
  email?: string;
  phone?: string;
  avatar?: string;
  passwordHash?: string;
  totpSecret?: string; // AES-256-GCM encrypted at rest
  twoFactorEnabled: boolean;
  twoFactorConfirmedAt?: Date;
  failedLoginCount: number;
  lockedUntil?: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    role: { type: String, enum: ["ADMIN", "STAFF", "DEAF_USER"], required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    passwordHash: { type: String, select: false },
    totpSecret: { type: String, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorConfirmedAt: { type: Date },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

// Unique email per organization, only for docs that HAVE an email.
// (A plain unique index would treat multiple null emails as duplicates,
//  which would collide Deaf-user records that have no email.)
userSchema.index(
  { organization: 1, email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: "string" } } },
);

export const User: Model<IUser> = mongoose.models.User ?? mongoose.model<IUser>("User", userSchema);
