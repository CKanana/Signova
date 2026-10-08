import { Router } from "express";
import {
  listStaffHandler,
  createStaffHandler,
  updateStaffHandler,
  setStaffActiveHandler,
  resetStaff2FAHandler,
} from "../controllers/staffController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth, requireRole("ADMIN"));

router.get("/", listStaffHandler);
router.post("/", createStaffHandler);
router.put("/:id", updateStaffHandler);
router.patch("/:id/status", setStaffActiveHandler);
router.post("/:id/2fa/reset", resetStaff2FAHandler);

export default router;
