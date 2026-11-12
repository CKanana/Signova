import { Router } from "express";
import {
  listTellersHandler,
  getTellerHandler,
  createTellerHandler,
  updateTellerHandler,
  availabilityHandler,
} from "../controllers/tellerController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Read: any authenticated role (mobile device, staff, admin).
router.get("/", requireAuth, listTellersHandler);
router.get("/:id", requireAuth, getTellerHandler);

// Write: admin only (staff may only change their own assigned teller's
// availability — enforced server-side by availabilityHandler).
router.post("/", requireAuth, requireRole("ADMIN"), createTellerHandler);
router.put("/:id", requireAuth, requireRole("ADMIN"), updateTellerHandler);
router.patch("/:id/availability", requireAuth, requireRole("ADMIN"), availabilityHandler);

export default router;
