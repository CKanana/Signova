import { isDatabaseConnected } from "../config/db.js";
import mongoose from "mongoose";
export async function healthHandler(_req, res) {
    const dbStates = ["disconnected", "connected", "connecting", "disconnecting"];
    res.json({
        status: "ok",
        db: dbStates[mongoose.connection.readyState] ?? "unknown",
        dbConnected: isDatabaseConnected(),
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
    });
}
//# sourceMappingURL=healthController.js.map