import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../../middleware/validate.js";
import { acceptBootstrap } from "../services/bootstrapService.js";
import { validatePasswordPolicy } from "../../utils/passwordPolicy.js";

const acceptSchema = z.object({
  token: z.string().min(1, "Setup token is required"),
  password: z.string().min(12, "Password must be at least 12 characters"),
});

export async function acceptBootstrapHandler(req: Request, res: Response): Promise<void> {
  const body = acceptSchema.parse(req.body);
  const passwordErrors = validatePasswordPolicy(body.password).reasons;
  if (passwordErrors.length > 0) {
    res.status(400).json({ error: { code: "VALIDATION_ERROR", message: passwordErrors[0], details: passwordErrors } });
    return;
  }
  const result = await acceptBootstrap({
    token: body.token,
    password: body.password,
  });
  res.status(200).json(result);
}
