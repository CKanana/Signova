import { Router } from "express";
import {
  getOrgHandler,
  updateOrgHandler,
} from "../controllers/organizationController.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { z } from "zod";

const router = Router();

// Org config is readable by any authenticated user (needed for branding).
router.get("/me", requireAuth, getOrgHandler);

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  shortName: z.string().min(1).optional(),
  welcomeMessage: z.string().optional(),
  serviceName: z.string().optional(),
  counterLabel: z.string().optional(),
  colors: z.object({ primary: z.string(), background: z.string() }).optional(),
  logoUrl: z.string().optional(),
});

router.put("/me", requireAuth, requireRole("ADMIN"), validate({ body: updateSchema }), updateOrgHandler);

export default router;
