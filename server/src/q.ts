import { connectDatabase } from "./config/db.js";
import { MongoClient } from "mongodb";
await connectDatabase();
const { config } = await import("./config/env.js");
const client = new MongoClient(config.mongodbUri);
await client.connect();
const db = client.db("signova");
console.log("DONE");
await client.close();
