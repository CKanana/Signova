import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createTestApp } from "../src/test/app.js";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

let mongod: any, base: string, serverInstance: any;

async function connect() {
  mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  await mongoose.connect(mongod.getUri());
}

async function disconnect() {
  if (mongod) { await mongoose.disconnect(); await mongod.stop(); mongod = undefined; }
}

describe("mini", () => {
  before(async () => {
    await connect();
    const app = createTestApp();
    serverInstance = require("node:http").createServer(app);
    await new Promise<void>((resolve) => serverInstance.listen(0, "127.0.0.1", () => {
      console.log("LISTENED on", serverInstance.address());
      resolve();
    }));
    base = `http://127.0.0.1:${serverInstance.address().port}`;
    console.log("BASE:", base);
  });

  after(async () => {
    if (serverInstance) { await new Promise<void>((resolve) => serverInstance.close(() => resolve())); serverInstance = undefined; }
    await disconnect();
  });

  test("t1", async () => {
    console.log("T1 base=", base);
    assert.ok(base);
  });
  test("t2", async () => {
    console.log("T2 base=", base);
    assert.ok(base);
  });
});
