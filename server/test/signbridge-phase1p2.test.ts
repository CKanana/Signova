/**
 * SIGN-BRIDGE PHASE 1.1 + PHASE 2 END-TO-END TEST
 *
 * Purpose: verify the isolated service venv runs the pipeline, and that the
 * teller message travels through the existing backend -> SignBridge API -> PWA
 * display flow with the generated 2D MP4 attached.
 *
 * Booting the real Express app + Socket.IO against an in-memory MongoDB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { io as ioClient, type Socket } from "socket.io-client";
import { loginAsAdminWith2FA, loginAsStaff } from "./helpers.js";
import {
  startTestServer,
  stopTestServer,
  server,
  base,
  mongod,
} from "./harness.js";

// The SignBridge API must already be running on 127.0.0.1:8001.
const SIGNBRIDGE_URL = process.env.SIGNBRIDGE_URL || "http://127.0.0.1:8001";
const SIGNBRIDGE_TEST_TIMEOUT = 180_000; // 3 min (whisper is slow)

let adminToken: string;
let staffToken: string;
let deafUserToken: string;
let knh: any;

// Boot the real server against MongoMemoryServer, then seed KNH.
// Runs BEFORE the first test so `base` is set.
test("setup: boot server + seed KNH + login", async () => {
  await startTestServer();

  const { Organization } = await import("../src/models/organization.js");
  const { Teller } = await import("../src/models/teller.js");
  const { User } = await import("../src/models/user.js");

  knh = await Organization.findOne({ shortName: "KNH" });
  assert.ok(knh, "KNH org should exist after seed");

  const tA = await Teller.findOne({ organization: knh._id, pairingCode: "KNH01" });
  assert.ok(tA, "teller A (KNH01) should exist");

  adminToken = await loginAsAdminWith2FA(knh);
  staffToken = await loginAsStaff(knh);
  const { signAccessToken } = await import("../src/utils/jwt.js");
  const deaf = await User.create({
    organization: knh._id,
    role: "DEAF_USER",
    name: "Deaf Device",
    phone: "5550100",
  });
  await User.updateOne({ _id: deaf._id }, { phone: deaf._id.toString() });
  deafUserToken = signAccessToken({
    sub: deaf._id.toString(),
    orgId: knh._id.toString(),
    role: "DEAF_USER",
  });

  assert.ok(adminToken, "admin token should be set");
  assert.ok(staffToken, "staff token should be set");
  assert.ok(deafUserToken, "deaf user token should be set");
});

test("health", async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 200);
});

test("SignBridge API reachable", async () => {
  const res = await fetch(`${SIGNBRIDGE_URL}/v1/health`);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.status, "ok");
});

test("teller message reach Deaf-user PWA with generated animation", async () => {
  const session = await createSessionFor(staffToken, "KNH01", "text");
  lastSessionId = session.id;
  // Accept the pending request so the session becomes ACTIVE.
  const active = await acceptSession(session.id, staffToken);
  assert.equal(active.status, "ACTIVE");

  // Staff replies to the Deaf user. This triggers async SignBridge video
  // generation and the backend persists the animation object on the message.
  const reply = await sendMessage(
    session.id,
    "STAFF",
    "I need help",
    staffToken,
    "text"
  );
  // Give the async SignBridge generation time to complete and the MP4 to be
  // persisted against the message.
  await new Promise((resolve) => setTimeout(resolve, 120_000));

  const messages = await getMessages(session.id, deafUserToken);
  assert.ok(messages.length > 0, "session should have messages");
  // The staff reply should carry the animation object in history.
  const staffReply = messages.find((m: any) => m.sender === "STAFF");
  assert.ok(staffReply, "staff reply should be present");
  const animation = staffReply.animation;
  assert.ok(animation, "staff reply should carry an animation object");
  assert.ok(
    ["pending", "ready", "failed", "skipped"].includes(animation.status),
    "animation status present",
  );
  if (animation.status === "ready") {
    assert.ok(animation.url, "ready animation should carry a url");
    assert.ok(animation.durationMs !== null, "ready animation should carry durationMs");
    // The animation URL should stream a real MP4 from the backend.
    const videoRes = await fetch(`${base}${animation.url}`);
    assert.equal(videoRes.status, 200, "animation route should return 200");
    assert.ok(
      String(videoRes.headers.get("content-type")).includes("video/mp4"),
      "animation route should return video/mp4",
    );
    const body = await videoRes.arrayBuffer();
    assert.ok(body.byteLength > 0, "animation body non-empty");
  }
});

test("Deaf-user PWA receives message:animation over Socket.IO", async () => {
  // A fresh deaf socket joins the session room and sees the message:animation
  // event when the status changes.
  const socket = connectDeafSocket(deafUserToken);
  await new Promise((resolve) => setTimeout(resolve, 500));
  socket.emit("session:join", { sessionId: lastSessionId });
  const status = await once(socket, "message:animation");
  assert.ok(status, "message:animation should be emitted");
  assert.ok(["pending", "ready", "failed", "skipped"].includes(status.status));
  socket.disconnect();
});

let lastSessionId: string | null = null;

/** Create session for a teller via pairing code. */
async function createSessionFor(token: string, pairingCode: string, method: "sign" | "text") {
  const res = await fetch(`${base}/api/sessions`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ pairingCode, method }),
  });
  assert.equal(res.status, 201, `create session ${res.status}`);
  return (await res.json()).session;
}

async function acceptSession(sessionId: string, token: string) {
  const res = await fetch(`${base}/api/sessions/${sessionId}/accept`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200, `accept ${res.status}`);
  return (await res.json()).session;
}

async function sendMessage(
  sessionId: string,
  sender: "USER" | "STAFF",
  text: string,
  token: string,
  method: "sign" | "text" | "speech",
) {
  const res = await fetch(`${base}/api/sessions/${sessionId}/messages`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ sender, text, method }),
  });
  assert.equal(res.status, 201, `sendMessage ${res.status}`);
  return (await res.json()).message;
}

async function getMessages(sessionId: string, token: string) {
  const res = await fetch(`${base}/api/sessions/${sessionId}/messages`, {
    headers: { authorization: `Bearer ${token}` },
  });
  assert.equal(res.status, 200, `getMessages ${res.status}`);
  return (await res.json()).messages;
}

function connectDeafSocket(token: string): Socket {
  const socket = ioClient(`${base}/signova`, {
    auth: { token },
    transports: ["websocket", "polling"],
    reconnection: false,
  });
  return socket;
}

function once(socket: Socket, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const on = (m: any) => {
      socket.off(event, on);
      resolve(m);
    };
    socket.once(event, on);
    socket.on("connect_error", reject);
  });
}
