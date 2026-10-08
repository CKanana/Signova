import { Router } from "express";
import { publicOrgHandler, publicTellersHandler } from "../controllers/publicController.js";
import { publicCreateSessionHandler } from "../controllers/publicSessionController.js";
import { apiLimiter } from "../middleware/rateLimit.js";

/**
 * Unauthenticated kiosk endpoints for the Deaf-user mobile app.
 * Mounted under /api/kiosk. Exposes only non-sensitive org config and the
 * ability to create a session (which returns a device-scoped token).
 */
const router = Router();

router.use(apiLimiter);

router.get("/organization", publicOrgHandler);
router.get("/tellers", publicTellersHandler);
router.post("/sessions", publicCreateSessionHandler);

export default router;
