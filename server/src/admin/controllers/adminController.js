import { z } from "zod";
import * as adminService from "../services/adminService.js";
import { recordAudit } from "../../services/auditService.js";
import { paramId } from "../../utils/params.js";
import { Organization } from "../../models/organization.js";
import { NotFoundError } from "../../utils/errors.js";
/**
 * Admin controllers.
 *
 * All endpoints are org-scoped: the organization ID is always taken from
 * the signed token's payload, never from the request. RBAC is enforced by
 * `requireAuth` + `requireRole` on every route; `assertSameOrg` is a
 * defense-in-depth re-check inside the service layer where it matters.
 */
const pageSchema = z.object({ page: z.coerce.number().int().min(1).default(1) });
const pageSizeSchema = z.object({ pageSize: z.coerce.number().int().min(1).max(500).default(50) });
// --- Organization settings ---
export const settingsUpdateSchema = z.object({
    name: z.string().min(1).optional(),
    shortName: z.string().min(1).optional(),
    welcomeMessage: z.string().optional(),
    serviceName: z.string().optional(),
    counterLabel: z.string().optional(),
    colors: z
        .object({
        primary: z.string().regex(/^#[0-9a-fA-F]{6}$/),
        background: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
        .optional(),
    logoUrl: z.string().url().optional(),
    restrictRegistrationByDomain: z.boolean().optional(),
    allowedEmailDomains: z.array(z.string().email()).optional(),
});
export async function getOrgSettingsHandler(req, res) {
    const org = await adminService.getOrganization(req.auth.orgId);
    res.json({ profile: org });
}
export async function updateOrgSettingsHandler(req, res) {
    const body = settingsUpdateSchema.parse(req.body);
    const org = await Organization.findByIdAndUpdate(req.auth.orgId, body, {
        new: true,
        runValidators: true,
    });
    if (!org)
        throw new NotFoundError("Organization not found");
    await recordAudit({ action: "ORG_UPDATE", actor: req.auth.sub, organization: req.auth.orgId, req });
    res.json({ profile: org });
}
// --- Overview metrics ---
export async function getOverviewHandler(req, res) {
    const orgId = req.auth.orgId;
    const [staff, tellersRes, sessions] = await Promise.all([
        adminService.listStaff(orgId, { onlyActive: false }),
        adminService.listTellers(orgId),
        adminService.listSessions(orgId, { status: undefined }),
    ]);
    const org = await adminService.getOrganization(orgId);
    const staffItems = staff.items;
    const tellerItems = tellersRes.items;
    const sessionItems = sessions.items;
    const staffActiveCount = staffItems.filter((s) => s.isActive).length;
    const tellerAvailableCount = tellerItems.filter((t) => t.status === "FREE").length;
    const tellerBusyCount = tellerItems.filter((t) => t.status === "BUSY").length;
    const tellerOfflineCount = tellerItems.filter((t) => t.status === "OFFLINE").length;
    const activeSessionCount = sessionItems.filter((s) => s.status !== "ENDED").length;
    const metrics = {
        organization: org,
        staffCount: staffItems.length,
        staffActiveCount,
        staffPendingCount: staffItems.filter((s) => !s.isActive).length,
        tellerCount: tellerItems.length,
        tellerAvailableCount,
        tellerBusyCount,
        tellerOfflineCount,
        activeSessionCount,
        totalSessionCount: sessionItems.length,
    };
    res.json({ metrics });
}
// --- Staff management ---
const listStaffQuerySchema = z.object({
    page: pageSchema.shape.page,
    pageSize: pageSizeSchema.shape.pageSize,
    search: z.string().max(100).optional(),
    role: z.enum(["STAFF", "ADMIN"]).optional(),
    status: z.enum(["active", "inactive", "pending"]).optional(),
    onlyActive: z.coerce.boolean().optional(),
    onlyInactive: z.coerce.boolean().optional(),
    onlyPending: z.coerce.boolean().optional(),
});
export async function listStaffHandler(req, res) {
    const query = listStaffQuerySchema.parse(req.query);
    const { items, total } = await adminService.listStaff(req.auth.orgId, {
        page: query.page,
        pageSize: query.pageSize,
        search: query.search,
        role: query.role,
        onlyActive: query.onlyActive,
        onlyInactive: query.onlyInactive,
        onlyPending: query.onlyPending,
    });
    res.json({ items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) });
}
export async function createStaffHandler(req, res) {
    const body = z
        .object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        role: z.enum(["STAFF", "ADMIN"]),
    })
        .parse(req.body);
    const { user, invitation } = await adminService.createStaff(req.auth.orgId, body, req.auth.sub, req);
    res.status(201).json({
        staff: user,
        invitation: invitation
            ? {
                id: invitation.id,
                name: invitation.name,
                email: invitation.email,
                role: invitation.role,
                invitationId: invitation.invitationId,
                expiresAt: invitation.expiresAt,
            }
            : null,
    });
}
export async function getStaffHandler(req, res) {
    const user = await adminService.getStaff(req.auth.orgId, paramId(req));
    if (!user)
        throw new NotFoundError("Staff user not found");
    res.json({ staff: user });
}
export async function updateStaffHandler(req, res) {
    const body = z
        .object({
        name: z.string().min(1).optional(),
        email: z.string().email().optional(),
        phone: z.string().optional(),
        role: z.enum(["STAFF", "ADMIN"]).optional(),
    })
        .parse(req.body);
    const user = await adminService.updateStaff(req.auth.orgId, paramId(req), body, req.auth.sub, req);
    res.json({ staff: user });
}
export async function setStaffActiveHandler(req, res) {
    const body = z.object({ active: z.boolean() }).parse(req.body);
    const user = await adminService.setStaffActive(req.auth.orgId, paramId(req), body.active, req.auth.sub, req);
    res.json({ staff: user });
}
export async function resetStaff2FAHandler(req, res) {
    await adminService.resetStaff2FA(req.auth.orgId, paramId(req), req.auth.sub, req);
    res.json({ ok: true });
}
export async function listPendingStaffHandler(req, res) {
    const { items, total } = await adminService.listStaff(req.auth.orgId, {
        onlyInactive: true,
        onlyPending: true,
    });
    res.json({ items, page: 1, pageSize: 50, total, totalPages: Math.ceil(total / 50) });
}
// --- Teller management ---
const listTellersQuerySchema = z.object({
    page: pageSchema.shape.page,
    pageSize: pageSizeSchema.shape.pageSize,
    status: z.enum(["FREE", "BUSY", "OFFLINE"]).optional(),
    search: z.string().max(100).optional(),
});
export async function listTellersHandler(req, res) {
    const query = listTellersQuerySchema.parse(req.query);
    const { items, total } = await adminService.listTellers(req.auth.orgId);
    res.json({ items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) });
}
export async function getTellerHandler(req, res) {
    const teller = await adminService.getTeller(req.auth.orgId, paramId(req));
    res.json({ teller });
}
export async function createTellerHandler(req, res) {
    const body = z
        .object({
        name: z.string().min(1),
        serviceLabel: z.string().optional(),
        serviceDesk: z.string().min(1),
        counterNumber: z.string().min(1),
        staffUser: z.string().optional(),
        pairingCode: z.string().min(4).max(8).optional(),
    })
        .parse(req.body);
    const teller = await adminService.createTeller(req.auth.orgId, body, req.auth.sub, req);
    res.status(201).json({ teller });
}
export async function updateTellerHandler(req, res) {
    const body = z
        .object({
        name: z.string().min(1).optional(),
        serviceLabel: z.string().optional(),
        serviceDesk: z.string().min(1).optional(),
        counterNumber: z.string().min(1).optional(),
        staffUser: z.string().optional(),
    })
        .parse(req.body);
    const teller = await adminService.updateTeller(req.auth.orgId, paramId(req), body, req.auth.sub, req);
    res.json({ teller });
}
export async function setTellerStatusHandler(req, res) {
    const body = z.object({ status: z.enum(["FREE", "BUSY", "OFFLINE"]) }).parse(req.body);
    const teller = await adminService.setTellerStatus(req.auth.orgId, paramId(req), body.status, req.auth.sub, req);
    res.json({ teller });
}
export async function assignStaffToTellerHandler(req, res) {
    const body = z.object({ staffUserId: z.string() }).parse(req.body);
    const teller = await adminService.assignStaffToTeller(req.auth.orgId, paramId(req), body.staffUserId, req.auth.sub, req);
    res.json({ teller });
}
// --- Session history ---
const listSessionsQuerySchema = z.object({
    page: pageSchema.shape.page,
    pageSize: pageSizeSchema.shape.pageSize,
    tellerId: z.string().optional(),
    status: z.enum(["CONNECTING", "ACTIVE", "ENDED"]).optional(),
});
export async function listSessionsHandler(req, res) {
    const query = listSessionsQuerySchema.parse(req.query);
    const { items, total } = await adminService.listSessions(req.auth.orgId, {
        tellerId: query.tellerId,
        status: query.status,
        page: query.page,
        pageSize: query.pageSize,
    });
    res.json({ items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) });
}
export async function getSessionHandler(req, res) {
    const session = await adminService.getSession(req.auth.orgId, paramId(req));
    res.json({ session });
}
// --- Audit logs ---
const listAuditLogsQuerySchema = z.object({
    page: pageSchema.shape.page,
    pageSize: pageSizeSchema.shape.pageSize,
    action: z.string().max(100).optional(),
    actor: z.string().optional(),
    target: z.string().optional(),
    from: z.string().optional(),
    to: z.string().optional(),
});
export async function listAuditLogsHandler(req, res) {
    const query = listAuditLogsQuerySchema.parse(req.query);
    const { items, total } = await adminService.listAuditLogs(req.auth.orgId, {
        action: query.action,
        actor: query.actor,
        target: query.target,
        page: query.page,
        pageSize: query.pageSize,
    });
    res.json({ items, page: query.page, pageSize: query.pageSize, total, totalPages: Math.ceil(total / query.pageSize) });
}
export async function getAuditLogsCountHandler(req, res) {
    const count = await adminService.listAuditLogs(req.auth.orgId, {}).then((r) => r.total);
    res.json({ count });
}
//# sourceMappingURL=adminController.js.map