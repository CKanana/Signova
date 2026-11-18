import { Router } from "express";
import { listMessagesHandler, sendMessageHandler, animationStreamHandler, retryAnimationHandler } from "../controllers/messageController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", listMessagesHandler);
router.post("/", sendMessageHandler);
// Phase 2: session-scoped animation video streaming (unguessable, not public).
router.get("/:messageId/animation", animationStreamHandler);
// Phase 2: manual retry for one message.
router.post("/:messageId/retry", retryAnimationHandler);

export default router;
