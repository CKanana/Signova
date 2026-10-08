import mongoose from "mongoose";
import { config } from "./env.js";

let connected = false;

export async function connectDatabase(): Promise<void> {
  if (connected) return;
  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(config.mongodbUri, {
      serverSelectionTimeoutMS: 10000,
    });
    connected = true;
    // eslint-disable-next-line no-console
    console.log("[db] MongoDB Atlas connected");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[db] Failed to connect to MongoDB:", (err as Error).message);
    process.exit(1);
  }
}

export async function disconnectDatabase(): Promise<void> {
  if (!connected) return;
  await mongoose.disconnect();
  connected = false;
  // eslint-disable-next-line no-console
  console.log("[db] MongoDB disconnected");
}

export function isDatabaseConnected(): boolean {
  return connected && mongoose.connection.readyState === 1;
}
