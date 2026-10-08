import { Router } from "express";
import {
  createSessionHandler,
  currentSessionHandler,
  getSessionHandler,
  listSessionsHandler,
  updateSessionStatusHandler,
} from "../controllers/sessionController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/", createSessionHandler);
router.get("/current", currentSessionHandler);
router.get("/", listSessionsHandler);
router.get("/:id", getSessionHandler);
router.patch("/:id/status", updateSessionStatusHandler);

export default router;
