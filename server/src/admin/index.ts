import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";
import { assertSameOrg } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { paramId } from "../utils/params.js";
import { adminAuthRouter } from "./auth.js";
import adminRouter from "./routes/adminRouter.js";
import { acceptInvitationHandler } from "./controllers/invitationController.js";
import { acceptBootstrapHandler } from "./controllers/bootstrapController.js";

const router = Router();

// Administration authentication (reuses the existing JWT + TOTP surface).
// Note: the sub-routes of adminAuthRouter are mounted at the ADMIN-only path
// so that login resolves to /api/admin/login (not /api/admin/auth/login).
router.use(adminAuthRouter);

// Public invitation acceptance (no bearer token required).
router.post("/invitations/accept", acceptInvitationHandler);

// Public bootstrap acceptance for the first administrator (no bearer token required).
router.post("/bootstrap/accept", acceptBootstrapHandler);

// Admin-only API surface. Every route is org-scoped; role enforced server-side.
router.use(requireAuth, requireRole("ADMIN"));

// Mount the admin API router once at /api/admin.
router.use(adminRouter);

export default router;
