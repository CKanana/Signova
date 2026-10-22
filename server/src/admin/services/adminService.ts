import { Organization } from "../../models/organization.js";
import { User } from "../../models/user.js";
import { Teller } from "../../models/teller.js";
import { Session } from "../../models/session.js";
import { AuditLog } from "../../models/auditLog.js";
import { NotFoundError, BadRequestError, ConflictError, ForbiddenError } from "../../utils/errors.js";
import type { Types } from "mongoose";
import type { Role, TellerStatus } from "../../../../shared/types/translation.js";

/** Admin service — org-scoped queries and mutations. */
export async function getOrganization(orgId: string | Types.ObjectId) {
  const org = await Organization.findById(orgId);
  if (!org) throw new NotFoundError("Organization not found");
  return org;
}

export async function listStaff(
  orgId: string | Types.ObjectId,
  opts: {
    page?: number;
    pageSize?: number;
    search?: string;
    role?: "STAFF" | "ADMIN";
    onlyActive?: boolean;
    onlyInactive?: boolean;
    onlyPending?: boolean;
  } = {}
): Promise<{ items: import("mongoose").Document<unknown, {}, import("../../models/user.js").IUser>[]; total: number }> {
  const filter: Record<string, unknown> = { organization: orgId, role: { $in: ["STAFF", "ADMIN"] } };
  if (opts.onlyActive) filter.isActive = true;
  if (opts.onlyInactive) filter.isActive = false;
  if (opts.onlyPending) filter.isActive = false;
  if (opts.search) {
    const q = new RegExp(opts.search, "i");
    filter.$or = [{ name: q }, { email: q }];
  }
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 50;
  const skip = (page > 0 ? page - 1 : 0) * pageSize;
  const [items, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    User.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getStaff(
  orgId: string | Types.ObjectId,
  userId: string
): Promise<import("mongoose").Document<unknown, {}, import("../../models/user.js").IUser> | null> {
  return User.findOne({ _id: userId, organization: orgId, role: { $in: ["STAFF", "ADMIN"] } });
}

export async function createStaff(
  orgId: string | Types.ObjectId,
  data: { name: string; email: string; phone?: string; role: Role },
  currentUserId: string,
  req: import("express").Request
): Promise<import("mongoose").Document<unknown, {}, import("../../models/user.js").IUser>> {
  const existing = await User.findOne({ organization: orgId, email: data.email.toLowerCase() });
  if (existing) throw new ConflictError("An account with this email already exists");
  if (data.role === "ADMIN") {
    const existingAdmin = await User.findOne({
      organization: orgId,
      role: "ADMIN",
      _id: { $ne: currentUserId },
    });
    if (!existingAdmin) {
      throw new ForbiddenError("Only an existing administrator can create another administrator");
    }
  }
  const user = await User.create({
    organization: orgId,
    role: data.role,
    name: data.name.trim(),
    email: data.email.toLowerCase(),
    phone: data.phone,
  });
  await recordAdminAudit("STAFF_CREATE", orgId, currentUserId, user._id.toString(), req);
  return user;
}

export async function updateStaff(
  orgId: string | Types.ObjectId,
  userId: string,
  updates: Partial<{ name: string; email: string; phone: string; role: Role }>,
  currentUserId: string,
  req: import("express").Request
): Promise<import("mongoose").Document<unknown, {}, import("../../models/user.js").IUser>> {
  if (updates.role) {
    const target = await User.findOne({
      _id: userId,
      organization: orgId,
      role: { $in: ["STAFF", "ADMIN"] },
    });
    if (!target) throw new NotFoundError("Staff user not found");
    const currentAdmin = await User.findOne({
      _id: currentUserId,
      organization: orgId,
      role: "ADMIN",
    });
    if (!currentAdmin) throw new ForbiddenError("Insufficient privileges");
    const isSelf = target._id.toString() === currentUserId;
    const adminCount = await User.countDocuments({ organization: orgId, role: "ADMIN" });
    if (isSelf && target.role === "ADMIN" && updates.role !== "ADMIN") {
      throw new ForbiddenError("You cannot demote yourself from administrator");
    }
    if (!currentAdmin) throw new ForbiddenError("Only administrators may change roles");
    if (target.role === "ADMIN" && updates.role === "STAFF" && adminCount <= 1) {
      throw new ForbiddenError("At least one administrator must remain");
    }
  }
  const user = await User.findOneAndUpdate(
    { _id: userId, organization: orgId, role: { $in: ["STAFF", "ADMIN"] } },
    updates,
    { new: true }
  );
  if (!user) throw new NotFoundError("Staff user not found");
  await recordAdminAudit("STAFF_UPDATE", orgId, currentUserId, user._id.toString(), req);
  return user;
}

export async function setStaffActive(
  orgId: string | Types.ObjectId,
  userId: string,
  active: boolean,
  currentUserId: string,
  req: import("express").Request
): Promise<import("mongoose").Document<unknown, {}, import("../../models/user.js").IUser>> {
  const user = await User.findOneAndUpdate(
    { _id: userId, organization: orgId, role: { $in: ["STAFF", "ADMIN"] } },
    { isActive: active },
    { new: true }
  );
  if (!user) throw new NotFoundError("Staff user not found");

  if (!active) {
    const targetRole = await User.findById(userId).select("role").lean();
    if (targetRole?.role === "ADMIN") {
      const remainingAdmins = await User.countDocuments({
        organization: orgId,
        role: "ADMIN",
        isActive: true,
      });
      if (remainingAdmins <= 1) {
        throw new ForbiddenError("At least one active administrator must remain");
      }
    }
    if (userId === currentUserId) {
      throw new ForbiddenError("You cannot deactivate your own account");
    }
  }

  await recordAdminAudit(
    active ? "STAFF_ACTIVATE" : "STAFF_DEACTIVATE",
    orgId,
    currentUserId,
    user._id.toString(),
    req
  );
  return user;
}

export async function resetStaff2FA(
  orgId: string | Types.ObjectId,
  userId: string,
  currentUserId: string,
  req: import("express").Request
): Promise<void> {
  const user = await User.findOne({
    _id: userId,
    organization: orgId,
    role: { $in: ["STAFF", "ADMIN"] },
  });
  if (!user) throw new NotFoundError("User not found");
  const { resetTwoFactor } = await import("../../services/authService.js");
  await resetTwoFactor(userId, currentUserId, req);
}

export async function recordAdminAudit(
  action: string,
  organization: unknown,
  actor: unknown,
  target?: string,
  req?: import("express").Request
): Promise<void> {
  try {
    await AuditLog.create({
      action,
      organization,
      actor,
      target,
      ip: req?.ip,
      userAgent: req?.headers?.["user-agent"],
    });
  } catch (err) {
    console.error("[audit] failed to record admin event", action, (err as Error).message);
  }
}

export async function listTellers(orgId: string | Types.ObjectId) {
  const items = await Teller.find({ organization: orgId }).sort({ counterNumber: 1 });
  return { items, total: items.length };
}

export async function getTeller(orgId: string | Types.ObjectId, tellerId: string) {
  const teller = await Teller.findOne({ _id: tellerId, organization: orgId });
  if (!teller) throw new NotFoundError("Teller not found");
  return teller;
}

export async function createTeller(
  orgId: string | Types.ObjectId,
  data: {
    name: string;
    serviceLabel?: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser?: string;
    pairingCode?: string;
  },
  currentUserId: string,
  req: import("express").Request
): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>> {
  const existing = await Teller.findOne({
    organization: orgId,
    pairingCode: data.pairingCode?.toUpperCase(),
  });
  if (existing) throw new ConflictError("Pairing code already in use");
  const teller = await Teller.create({
    ...data,
    pairingCode: data.pairingCode?.toUpperCase() ?? `TMP${Date.now()}`,
    organization: orgId,
  });
  await recordAdminAudit("TELLER_CREATE", orgId, currentUserId, teller._id.toString(), req);
  return teller;
}

export async function updateTeller(
  orgId: string | Types.ObjectId,
  tellerId: string,
  updates: Partial<{
    name: string;
    serviceLabel: string;
    serviceDesk: string;
    counterNumber: string;
    staffUser: string;
  }>,
  currentUserId: string,
  req: import("express").Request
): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>> {
  const teller = await Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId },
    updates,
    { new: true }
  );
  if (!teller) throw new NotFoundError("Teller not found");
  await recordAdminAudit("TELLER_UPDATE", orgId, currentUserId, teller._id.toString(), req);
  return teller;
}

export async function setTellerStatus(
  orgId: string | Types.ObjectId,
  tellerId: string,
  status: TellerStatus,
  currentUserId: string,
  req: import("express").Request
): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>> {
  const session = await Session.findOne({
    organization: orgId,
    teller: tellerId,
    status: { $in: ["CONNECTING", "ACTIVE"] },
  });
  if (session && status !== "BUSY") {
    throw new BadRequestError(
      "Cannot change teller status while they have an active session. Deactivate the session first."
    );
  }
  if (status === "FREE") {
    const counts = await Session.countDocuments({
      organization: orgId,
      teller: tellerId,
      status: { $in: ["CONNECTING", "ACTIVE"] },
    });
    if (counts > 0) {
      throw new BadRequestError("Teller has active sessions and cannot be reassigned to free.");
    }
  }
  const teller = await Teller.findOneAndUpdate(
    { _id: tellerId, organization: orgId },
    { status },
    { new: true }
  );
  if (!teller) throw new NotFoundError("Teller not found");
  await recordAdminAudit(`TELLER_${status}`, orgId, currentUserId, teller._id.toString(), req);
  return teller;
}

export async function assignStaffToTeller(
  orgId: string | Types.ObjectId,
  tellerId: string,
  staffUserId: string,
  currentUserId: string,
  req: import("express").Request
): Promise<import("mongoose").Document<unknown, {}, import("../../models/teller.js").ITeller>> {
  const teller = await Teller.findOne({ _id: tellerId, organization: orgId });
  if (!teller) throw new NotFoundError("Teller not found");
  const user = await User.findOne({
    _id: staffUserId,
    organization: orgId,
    role: "STAFF",
    isActive: true,
  });
  if (!user) throw new NotFoundError("Staff user not found");

  const session = await Session.findOne({
    organization: orgId,
    teller: tellerId,
    status: { $in: ["CONNECTING", "ACTIVE"] },
  });
  if (session) {
    throw new BadRequestError(
      "This teller has an active session and cannot be assigned. Free the session first."
    );
  }
  return updateTeller(orgId, tellerId, { staffUser: staffUserId }, currentUserId, req);
}

export async function listSessions(
  orgId: string | Types.ObjectId,
  opts: { tellerId?: string; status?: string; page?: number; pageSize?: number }
): Promise<{ items: import("mongoose").Document<unknown, {}, import("../../models/session.js").ISession>[]; total: number }> {
  const filter: Record<string, unknown> = { organization: orgId };
  if (opts.tellerId) filter.teller = opts.tellerId;
  if (opts.status) filter.status = opts.status;
  const page = opts.page ?? 1;
  const pageSize = opts.pageSize ?? 100;
  const skip = (page > 0 ? page - 1 : 0) * pageSize;
  const [items, total] = await Promise.all([
    Session.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
    Session.countDocuments(filter),
  ]);
  return { items, total };
}

export async function getSession(orgId: string | Types.ObjectId, sessionId: string) {
  const session = await Session.findOne({ _id: sessionId, organization: orgId });
  if (!session) throw new NotFoundError("Session not found");
  return session;
}

export async function listAuditLogs(
  orgId: string | Types.ObjectId,
  opts: {
    action?: string;
    actor?: string;
    target?: string;
    page?: number;
    pageSize?: number;
  }
): Promise<{ items: import("mongoose").Document<unknown, {}, import("../../models/auditLog.js").IAuditLog>[]; total: number }> {
  const filter: Record<string, unknown> = { organization: orgId };
  if (opts.action) filter.action = opts.action;
  if (opts.actor) filter.actor = opts.actor;
  if (opts.target) filter.target = opts.target;
  const [items, total] = await Promise.all([
    AuditLog.find(filter).sort({ at: -1 }).limit(opts.pageSize ?? 100),
    AuditLog.countDocuments(filter),
  ]);
  return { items, total };
}
