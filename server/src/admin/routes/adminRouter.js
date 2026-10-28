import { Router } from "express";
import { getOverviewHandler, getOrgSettingsHandler, updateOrgSettingsHandler, listStaffHandler, createStaffHandler, getStaffHandler, updateStaffHandler, setStaffActiveHandler, resetStaff2FAHandler, listPendingStaffHandler, listTellersHandler, getTellerHandler, createTellerHandler, updateTellerHandler, setTellerStatusHandler, assignStaffToTellerHandler, listSessionsHandler, getSessionHandler, listAuditLogsHandler, getAuditLogsCountHandler, } from "../controllers/adminController.js";
import { inviteStaffHandler, acceptInvitationHandler, resendInvitationHandler } from "../controllers/invitationController.js";
import { acceptStaffSetupHandler, activateStaffSetupHandler } from "../controllers/staffSetupController.js";
import { inviteLimiter } from "../../middleware/rateLimit.js";
const router = Router();
// Staff invitations
router.post("/staff/invite", inviteLimiter, inviteStaffHandler);
router.post("/staff/invite/resend", inviteLimiter, resendInvitationHandler);
router.post("/invitations/accept", inviteLimiter, acceptInvitationHandler);
router.post("/staff/setup/accept", inviteLimiter, acceptStaffSetupHandler);
router.post("/staff/setup/activate", inviteLimiter, activateStaffSetupHandler);
// Overview
router.get("/overview", getOverviewHandler);
// Organization settings
router.get("/organization/settings", getOrgSettingsHandler);
router.put("/organization/settings", updateOrgSettingsHandler);
// Staff management
router.get("/staff", listStaffHandler);
router.post("/staff", createStaffHandler);
router.get("/staff/pending", listPendingStaffHandler);
router.get("/staff/:id", getStaffHandler);
router.put("/staff/:id", updateStaffHandler);
router.patch("/staff/:id/status", setStaffActiveHandler);
router.post("/staff/:id/2fa/reset", resetStaff2FAHandler);
// Teller management
router.get("/tellers", listTellersHandler);
router.post("/tellers", createTellerHandler);
router.get("/tellers/:id", getTellerHandler);
router.put("/tellers/:id", updateTellerHandler);
router.patch("/tellers/:id/status", setTellerStatusHandler);
router.post("/tellers/:id/assign", assignStaffToTellerHandler);
// Session history
router.get("/sessions", listSessionsHandler);
router.get("/sessions/:id", getSessionHandler);
// Audit logs
router.get("/audit-logs", listAuditLogsHandler);
router.get("/audit-logs/count", getAuditLogsCountHandler);
export default router;
//# sourceMappingURL=adminRouter.js.map