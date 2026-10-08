import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { translate } from "../services/translationService.js";
import { getSessionById } from "../services/sessionService.js";
import { logSessionEvent, recordLatency } from "../services/sessionService.js";
import { paramId } from "../utils/params.js";
import { config } from "../config/env.js";

const translateSchema = z.object({
  input: z.unknown().optional(),
  durationMs: z.number().optional(),
});

/**
 * POST /api/sessions/:id/translate
 *
 * Calls the MOCK translation service and returns the shared `Translation`
 * contract. Phase 6 replaces only the service implementation — this endpoint
 * and the mobile client remain unchanged.
 */
export const translateHandler = [
  validate({ body: translateSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const session = await getSessionById(req.auth!.orgId, paramId(req));
    const startedAt = Date.now();
    const result = await translate({ input: req.body.input, durationMs: req.body.durationMs });
    const latency = Date.now() - startedAt;

    await recordLatency(session._id.toString(), req.auth!.orgId, latency);
    await logSessionEvent(session._id.toString(), req.auth!.orgId, "translation_returned", {
      confidence: result.confidence,
      latencyMs: latency,
    });

    res.json({
      translation: result,
      latencyMs: latency,
      lowConfidence: result.confidence < config.lowConfidenceThreshold,
    });
  },
];
