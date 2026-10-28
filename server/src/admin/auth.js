import { Router } from "express";
import { loginHandler, verifyTwoFactorHandler, enrollStartHandler, enrollActivateHandler, logoutHandler, refreshHandler, meHandler } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireRole } from "../middleware/auth.js";
export const adminAuthRouter = Router();
// Authentication endpoints (reuse the existing staff auth controller).
adminAuthRouter.post("/login", loginHandler);
adminAuthRouter.post("/2fa/verify", verifyTwoFactorHandler);
adminAuthRouter.post("/2fa/enroll/start", enrollStartHandler);
adminAuthRouter.post("/2fa/enroll/activate", enrollActivateHandler);
adminAuthRouter.post("/logout", logoutHandler);
adminAuthRouter.post("/refresh", refreshHandler);
// Protected admin-only introspection (no weaker path).
adminAuthRouter.get("/me", requireAuth, requireRole("ADMIN"), meHandler);
//# sourceMappingURL=auth.js.map