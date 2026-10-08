import type { Request, Response } from "express";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { listMessages, sendMessage } from "../services/messageService.js";
import { paramId } from "../utils/params.js";

const sendSchema = z.object({
  sender: z.enum(["USER", "STAFF"]),
  text: z.string().min(1).max(2000),
  method: z.enum(["sign", "text", "speech"]),
  confidence: z.number().min(0).max(1).optional(),
  isConfirmed: z.boolean().optional(),
});

export const listMessagesHandler = async (req: Request, res: Response): Promise<void> => {
  const messages = await listMessages(req.auth!.orgId, paramId(req));
  res.json({ messages });
};

export const sendMessageHandler = [
  validate({ body: sendSchema }),
  async (req: Request, res: Response): Promise<void> => {
    const message = await sendMessage(req.auth!.orgId, paramId(req), req.body);
    res.status(201).json({ message });
  },
];
