import { Router } from "express";
import { translateHandler } from "../controllers/translationController.js";
import { requireAuth } from "../middleware/auth.js";

/**
 * Translation endpoint, mounted at /api/sessions/:id/translate.
 * Declared directly on the sessions router (not a sub-router with mergeParams)
 * so Express 5 matches it before the generic /:id and /:id/messages routes.
 */
const router = Router();

router.use(requireAuth);
router.post("/:id/translate", translateHandler);

export default router;
