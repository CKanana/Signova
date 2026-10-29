import mongoose, { Schema } from "mongoose";
import type { Model } from "mongoose";

export interface IInvitation {
  _id: Schema.Types.ObjectId;
  user: Schema.Types.ObjectId;
  email: string;
  organization: Schema.Types.ObjectId;
  invitedBy: Schema.Types.ObjectId;
  tokenHash: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: Date;
  acceptedAt?: Date;
  revokedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const invitationSchema = new Schema<IInvitation>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    tokenHash: { type: String, required: true },
    status: { type: String, enum: ["pending", "accepted", "revoked", "expired"], default: "pending", index: true },
    expiresAt: { type: Date, required: true, index: true },
    acceptedAt: { type: Date },
    revokedAt: { type: Date },
  },
  { timestamps: true },
);

invitationSchema.index({ email: 1, organization: 1 });
// Strong single-use guarantee: while an invitation is pending, its tokenHash must be unique.
// Once accepted/expired/revoked, the partial index no longer applies to that document.
invitationSchema.index(
  { tokenHash: 1 },
  { unique: true, partialFilterExpression: { status: "pending" } },
);

export const Invitation: Model<IInvitation> =
  mongoose.models.Invitation ?? mongoose.model<IInvitation>("Invitation", invitationSchema);
