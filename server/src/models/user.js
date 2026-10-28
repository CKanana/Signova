import mongoose, { Schema } from "mongoose";
const userSchema = new Schema({
    organization: { type: Schema.Types.ObjectId, ref: "Organization", required: true, index: true },
    role: { type: String, enum: ["ADMIN", "STAFF", "DEAF_USER"], required: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, trim: true, sparse: true },
    phone: { type: String, trim: true },
    avatar: { type: String },
    passwordHash: { type: String, select: false },
    totpSecret: { type: String, select: false },
    totpLastUsedStep: { type: Number, select: false },
    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorConfirmedAt: { type: Date },
    failedLoginCount: { type: Number, default: 0 },
    lockedUntil: { type: Date },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });
// Unique email per organization, only for docs that HAVE an email.
// (A plain unique index would treat multiple null emails as duplicates,
//  which would collide Deaf-user records that have no email.)
userSchema.index({ organization: 1, email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
export const User = mongoose.models.User ?? mongoose.model("User", userSchema);
//# sourceMappingURL=user.js.map