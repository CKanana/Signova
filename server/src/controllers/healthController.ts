import type { Request, Response } from "express";
import { isDatabaseConnected } from "../config/db.js";
import mongoose from "mongoose";

export async function healthHandler(_req: Request, res: Response): Promise<void> {
  const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
  res.json({
    status: "ok",
    db: dbStates[mongoose.connection.readyState] ?? "unknown",
    dbConnected: isDatabaseConnected(),
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
}
