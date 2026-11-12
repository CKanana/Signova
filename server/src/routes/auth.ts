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
  forgotPasswordHandler,
  resetPasswordHandler,
  rejectPublicRegistrationHandler,
  loginWithGoogleHandler,
  loginWithGoogleSchema,
} from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { authLimiter, forgotPasswordLimiter, resetPasswordLimiter } from "../middleware/rateLimit.js";
import { validate } from "../middleware/validate.js";

const router = Router();

router.post("/login", authLimiter, loginHandler);
router.post("/login-with-google", authLimiter, validate({ body: loginWithGoogleSchema }), loginWithGoogleHandler);
router.post("/register", authLimiter, rejectPublicRegistrationHandler);
router.post("/forgot-password", forgotPasswordLimiter, forgotPasswordHandler);
router.post("/reset-password", resetPasswordLimiter, resetPasswordHandler);
router.post("/2fa/verify", authLimiter, verifyTwoFactorHandler);
router.post("/2fa/enroll/start", authLimiter, enrollStartHandler);
router.post("/2fa/enroll/activate", authLimiter, enrollActivateHandler);
router.post("/logout", logoutHandler);
router.post("/refresh", refreshHandler);

router.get("/me", requireAuth, meHandler);
router.post("/change-password", requireAuth, changePasswordHandler);

export default router;
