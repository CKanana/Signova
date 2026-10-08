import { Router } from "express";
import {
  listMessagesHandler,
  sendMessageHandler,
} from "../controllers/messageController.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router({ mergeParams: true });

router.use(requireAuth);

router.get("/", listMessagesHandler);
router.post("/", sendMessageHandler);

export default router;
