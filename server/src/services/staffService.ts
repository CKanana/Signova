import { User } from "../models/user.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { hashPassword } from "./tokenService.js";
import { recordAudit } from "./auditService.js";
import { revokeAllRefreshTokens } from "./tokenService.js";
import type { Request } from "express";
import type { Types } from "mongoose";

export async function listStaff(orgId: string | Types.ObjectId) {
  return User.find({ organization: orgId, role: { $in: ["STAFF", "ADMIN"] } }).sort({ createdAt: -1 });
}

export async function createStaff(
  orgId: string | Types.ObjectId,
  data: { name: string; email: string; phone?: string; password: string; role: "STAFF" | "ADMIN" },
  req: Request,
) {
  const existing = await User.findOne({ organization: orgId, email: data.email.toLowerCase() });
  if (existing) throw new ConflictError("Email already in use for this organization");
  const user = await User.create({
    organization: orgId,
    role: data.role,
    name: data.name,
    email: data.email.toLowerCase(),
    phone: data.phone,
    passwordHash: await hashPassword(data.password),
  });
  await recordAudit({ action: "STAFF_CREATE", actor: req.auth?.sub, organization: orgId, target: user._id.toString(), req });
  return user;
}

export async function updateStaff(
  orgId: string | Types.ObjectId,
  userId: string,
  updates: Partial<{ name: string; email: string; phone: string }>,
  req: Request,
) {
  const user = await User.findOneAndUpdate(
    { _id: userId, organization: orgId, role: { $in: ["STAFF", "ADMIN"] } },
    updates,
    { new: true },
  );
  if (!user) throw new NotFoundError("Staff user not found");
  await recordAudit({ action: "STAFF_UPDATE", actor: req.auth?.sub, organization: orgId, target: userId, req });
  return user;
}

export async function setStaffActive(
  orgId: string | Types.ObjectId,
  userId: string,
  active: boolean,
  req: Request,
) {
  const user = await User.findOneAndUpdate(
    { _id: userId, organization: orgId, role: { $in: ["STAFF", "ADMIN"] } },
    { isActive: active },
    { new: true },
  );
  if (!user) throw new NotFoundError("Staff user not found");
  if (!active) await revokeAllRefreshTokens(userId);
  await recordAudit({
    action: active ? "STAFF_ACTIVATE" : "STAFF_DEACTIVATE",
    actor: req.auth?.sub,
    organization: orgId,
    target: userId,
    req,
  });
  return user;
}
