import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";
import { adminAuthRouter } from "./auth.js";
import adminRouter from "./routes/adminRouter.js";
import { acceptInvitationHandler, acceptInvitationByIdHandler } from "./controllers/invitationController.js";
import { acceptStaffSetupHandler, activateStaffSetupHandler } from "./controllers/staffSetupController.js";
import { acceptBootstrapHandler } from "./controllers/bootstrapController.js";
import { inviteLimiter } from "../middleware/rateLimit.js";

const router = Router();

// Administration authentication (reuses the existing JWT + TOTP surface).
// Mounted at both root and /auth so /api/admin/login and /api/admin/auth/login both work.
router.use(adminAuthRouter);
router.use("/auth", adminAuthRouter);

// Public invitation acceptance (no bearer token required).
router.post("/invitations/accept", inviteLimiter, acceptInvitationHandler);
router.post("/invitations/:invitationId/accept", inviteLimiter, acceptInvitationByIdHandler);

// Public staff setup acceptance & 2FA activation (no bearer token required).
router.post("/staff/setup/accept", inviteLimiter, acceptStaffSetupHandler);
router.post("/staff/setup/activate", inviteLimiter, activateStaffSetupHandler);

// Public bootstrap acceptance for the first administrator (no bearer token required).
router.post("/bootstrap/accept", acceptBootstrapHandler);

// Admin-only API surface. Every route is org-scoped; role enforced server-side.
router.use(requireAuth, requireRole("ADMIN"));

// Mount the admin API router once at /api/admin.
router.use(adminRouter);

export default router;
