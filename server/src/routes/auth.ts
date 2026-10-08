import { Router } from "express";
import {
  loginHandler,
  verifyTwoFactorHandler,
  enrollStartHandler,
  enrollActivateHandler,
  logoutHandler,
  refreshHandler,
  meHandler,
  changePasswordHandler,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";

const router = Router();

router.post("/login", authLimiter, loginHandler);
router.post("/2fa/verify", authLimiter, verifyTwoFactorHandler);
router.post("/2fa/enroll/start", authLimiter, enrollStartHandler);
router.post("/2fa/enroll/activate", authLimiter, enrollActivateHandler);
router.post("/logout", logoutHandler);
router.post("/refresh", refreshHandler);

router.get("/me", requireAuth, meHandler);
router.post("/change-password", requireAuth, changePasswordHandler);

export default router;
