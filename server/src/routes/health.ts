import { Router } from "express";
import { healthHandler } from "../controllers/healthController.js";

const router = Router();

router.get("/", healthHandler);

export default router;
