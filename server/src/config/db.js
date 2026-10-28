import mongoose from "mongoose";
import { config } from "./env.js";
let connected = false;
export async function connectDatabase() {
    if (connected)
        return;
    try {
        mongoose.set("strictQuery", true);
        await mongoose.connect(config.mongodbUri, {
            serverSelectionTimeoutMS: 10000,
        });
        connected = true;
        // eslint-disable-next-line no-console
        console.log("[db] MongoDB Atlas connected");
    }
    catch (err) {
        // eslint-disable-next-line no-console
        console.error("[db] Failed to connect to MongoDB:", err.message);
        process.exit(1);
    }
}
export async function disconnectDatabase() {
    if (!connected)
        return;
    await mongoose.disconnect();
    connected = false;
    // eslint-disable-next-line no-console
    console.log("[db] MongoDB disconnected");
}
export function isDatabaseConnected() {
    return connected && mongoose.connection.readyState === 1;
}
//# sourceMappingURL=db.js.map