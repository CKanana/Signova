/**
 * Manual end-to-end audit for the teller -> SignBridge -> Deaf-user path.
 * Run from server/:  node --import tsx test/manual-e2e-text-to-sign.ts
 */
import http from "node:http";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { io as ioClient, type Socket } from "socket.io-client";

const results: Array<{ name: string; ok: boolean; detail: string }> = [];
function record(name: string, ok: boolean, detail: string) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}
function assert(cond: unknown, message: string): asserts cond {
  if (!cond) throw new Error(message);
}

let mem: MongoMemoryServer;
let server: http.Server;
let base = "";
let staffToken = "";
let deafToken = "";
let sessionId = "";

async function main() {
  mem = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mem.getUri();
  process.env.SIGNBRIDGE_ENABLED = "true";
  process.env.SIGNBRIDGE_URL = "http://127.0.0.1:8001";
  await mongoose.connect(mem.getUri());

  const { seed } = await import("../src/seed/seed.js");
  await seed();

  const { createTestApp } = await import("../src/test/app.js");
  const { initRealtime } = await import("../src/realtime/gateway.js");
  const { signAccessToken } = await import("../src/utils/jwt.js");
  const { Organization } = await import("../src/models/organization.js");
  const { Teller } = await import("../src/models/teller.js");
  const { User } = await import("../src/models/user.js");

  const app = await createTestApp();
  server = http.createServer(app);
  await new Promise<void>((r) => server.listen(0, () => r()));
  base = `http://127.0.0.1:${(server.address() as any).port}`;
  initRealtime(server);

  const knh = await Organization.findOne({ shortName: "KNH" });
  assert(knh, "KNH seeded");
  const staff = await User.findOne({ organization: knh._id, email: "grace@signova.test" });
  assert(staff, "staff seeded");
  const teller = await Teller.findOne({ organization: knh._id, pairingCode: "KNH01" });
  assert(teller, "teller seeded");
  assert(String(teller.staffUser) === String(staff._id), "teller assigned to staff");
  staffToken = signAccessToken({
    sub: staff._id.toString(),
    orgId: knh._id.toString(),
    role: "STAFF",
  });

  // ---- 1. Deaf user creates a session through the real kiosk endpoint ----
  const created = await post("/api/kiosk/sessions", {
    pairingCode: "KNH01",
    method: "sign",
    deviceId: "e2e-deaf-device-0001",
  });
  assert(created.status === 201, `kiosk session ${created.status}`);
  sessionId = created.body.session._id;
  deafToken = created.body.accessToken;
  record("deaf user creates session", created.status === 201, `session ${sessionId}`);

  // ---- 2. Teller accepts the request ----
  const accepted = await post(`/api/sessions/${sessionId}/accept`, undefined, staffToken);
  assert(accepted.status === 200 && accepted.body.session.status === "ACTIVE", "accept");
  record("teller accepts session", true, `status=${accepted.body.session.status}`);

  // ---- 3. Connect both realtime clients ----
  const staffSocket = connect(staffToken);
  const deafSocket = connect(deafToken);
  await waitConnect(staffSocket);
  await waitConnect(deafSocket);
  staffSocket.emit("session:join", { sessionId });
  deafSocket.emit("session:join", { sessionId });
  await sleep(300);
  record("socket clients join session room", staffSocket.connected && deafSocket.connected, "both connected");

  // ---- 4. Teller sends the definition-of-done sentence over Socket.IO ----
  const staffMessageEvent = once<StaffMessagePayload>(deafSocket, "staff:message", 10_000);
  const animationEvent = once<AnimationPayload>(deafSocket, "message:animation", 180_000);
  staffSocket.emit("message:send", {
    sessionId,
    text: "How can I help you today?",
    method: "speech",
  });

  const staffMessage = await staffMessageEvent;
  record(
    "teller message reaches Deaf user in real time",
    staffMessage.text === "How can I help you today?" && staffMessage.sender === "STAFF",
    `id=${staffMessage.id} status=${staffMessage.animation?.status}`,
  );
  record(
    "socket payload carries the pending animation object",
    staffMessage.animation !== null && staffMessage.animation !== undefined,
    JSON.stringify(staffMessage.animation),
  );

  const anim = await animationEvent;
  record(
    "message:animation reports ready from SignBridge",
    anim.status === "ready" && !!anim.url && (anim.durationMs ?? 0) > 0,
    `status=${anim.status} url=${anim.url} durationMs=${anim.durationMs}`,
  );

  // ---- 5. History carries the animation on the right message ----
  const history = await get(`/api/sessions/${sessionId}/messages`, deafToken);
  assert(history.status === 200, "history");
  const staffRecord = history.body.messages.find((m: any) => m._id === anim.messageId);
  record(
    "history associates animation with the correct message",
    staffRecord?.animation?.status === "ready" && staffRecord?.animation?.url === anim.url,
    `messageId=${anim.messageId} text=${staffRecord?.text}`,
  );

  // ---- 6. Animation media is streamed and protected ----
  const video = await fetch(`${base}${anim.url}`, {
    headers: { authorization: `Bearer ${deafToken}` },
  });
  const bytes = Buffer.from(await video.arrayBuffer());
  record(
    "animation MP4 streams to the Deaf user",
    video.status === 200 &&
      String(video.headers.get("content-type")).includes("video/mp4") &&
      bytes.byteLength > 10_000 &&
      bytes.slice(4, 8).toString() === "ftyp",
    `status=${video.status} bytes=${bytes.byteLength} type=${video.headers.get("content-type")}`,
  );
  const unauth = await fetch(`${base}${anim.url}`);
  record("animation media requires authentication", unauth.status === 401, `status=${unauth.status}`);

  const replay = await fetch(`${base}${anim.url}`, {
    headers: { authorization: `Bearer ${deafToken}` },
  });
  record("animation can be replayed", replay.status === 200, `status=${replay.status}`);

  // ---- 7. Structured 2D pose for the SVG avatar ----
  const poseRes = await get(
    `/api/sessions/${sessionId}/messages/${anim.messageId}/pose`,
    deafToken,
  );
  const pose = poseRes.body.pose;
  record(
    "structured 2D pose renders from SignBridge joints",
    poseRes.status === 200 &&
      pose?.source === "signbridge" &&
      pose?.joints?.length > 0 &&
      pose?.frames?.length > 0 &&
      pose?.glosses?.length > 0,
    `glosses=${pose?.glosses?.join("|")} frames=${pose?.frames?.length} joints=${pose?.joints?.length}`,
  );

  // ---- 8. A second reply gets its own animation (no overwrite) ----
  const anim2Promise = waitAnimationFor(deafSocket, 180_000);
  staffSocket.emit("message:send", {
    sessionId,
    text: "Thank you for your help",
    method: "speech",
  });
  const anim2 = await anim2Promise;
  const history2 = await get(`/api/sessions/${sessionId}/messages`, deafToken);
  const first = history2.body.messages.find((m: any) => m._id === anim.messageId);
  const second = history2.body.messages.find((m: any) => m._id === anim2.messageId);
  record(
    "multiple replies keep their own animations",
    first?.animation?.status === "ready" &&
      second?.animation?.status === "ready" &&
      first.animation.url !== second.animation.url,
    `m1=${first?.animation?.url} m2=${second?.animation?.url}`,
  );

  // ---- 8b. Unsupported vocabulary is reported, not silently invented ----
  const anim3Promise = waitAnimationFor(deafSocket, 180_000);
  staffSocket.emit("message:send", {
    sessionId,
    text: "Please verify my identity and account balance",
    method: "speech",
  });
  const anim3 = await anim3Promise;
  const pose3Res = await get(
    `/api/sessions/${sessionId}/messages/${anim3.messageId}/pose`,
    deafToken,
  );
  const pose3 = pose3Res.body.pose;
  record(
    "unsupported words are reported honestly and the rest still animates",
    pose3Res.status === 200 &&
      Array.isArray(pose3?.droppedWords) &&
      pose3.droppedWords.length > 0 &&
      pose3.frames?.length > 0 &&
      pose3.glosses?.length > 0,
    `dropped=${pose3?.droppedWords?.join(",")} glosses=${pose3?.glosses?.join("|")}`,
  );

  // ---- 9. Deaf user -> teller text ----
  const staffNewMessage = once<any>(staffSocket, "message:new", 10_000);
  deafSocket.emit("message:send", {
    sessionId,
    text: "My card was declined",
    method: "sign",
    confidence: 0.92,
    isConfirmed: true,
  });
  const incoming = await staffNewMessage;
  record(
    "Deaf-user message reaches the teller dashboard",
    incoming.sender === "USER" && incoming.text === "My card was declined" && incoming.isConfirmed,
    `sender=${incoming.sender} text=${incoming.text} confirmed=${incoming.isConfirmed}`,
  );
  const staffHistory = await get(`/api/sessions/${sessionId}/messages`, staffToken);
  record(
    "Deaf-user message is persisted",
    staffHistory.body.messages.some((m: any) => m.text === "My card was declined" && m.sender === "USER"),
    `${staffHistory.body.messages.length} messages`,
  );

  // ---- 10. Session isolation: another session's media is forbidden ----
  const otherSession = await post("/api/kiosk/sessions", {
    pairingCode: "KNH02",
    method: "text",
    deviceId: "e2e-deaf-device-0002",
  });
  assert(otherSession.status === 201, "second kiosk session");
  const otherId = otherSession.body.session._id;
  const otherDeafToken = otherSession.body.accessToken;
  await post(`/api/sessions/${otherId}/accept`, undefined, staffToken).catch(() => undefined);
  const otherHistory = await get(`/api/sessions/${otherId}/messages`, otherDeafToken);
  const cross = await fetch(`${base}/api/sessions/${otherId}/messages/${anim.messageId}/animation`, {
    headers: { authorization: `Bearer ${otherDeafToken}` },
  });
  record(
    "session isolation blocks cross-session animation access",
    cross.status === 403 || cross.status === 404,
    `status=${cross.status} messages=${otherHistory.body.messages.length}`,
  );

  // ---- 11. Terminate the session ----
  const endEvent = once<{ sessionId: string; status?: string }>(deafSocket, "session:ended", 10_000);
  const ended = await patch(`/api/sessions/${sessionId}/status`, { status: "ENDED", endReason: "STAFF_ENDED" }, staffToken);
  const endPayload = await endEvent.catch(() => null);
  record(
    "session termination notifies the Deaf user in real time",
    ended.status === 200 && ended.body.session.status === "ENDED" && endPayload?.sessionId === sessionId,
    `status=${ended.body.session?.status} event=${JSON.stringify(endPayload)}`,
  );
  const freed = await Teller.findById(teller._id).lean();
  record("session termination frees the teller counter", (freed as any)?.status === "FREE", `teller=${(freed as any)?.status}`);

  staffSocket.disconnect();
  deafSocket.disconnect();
}

type StaffMessagePayload = any;
type AnimationPayload = {
  sessionId: string;
  messageId: string;
  status: string;
  url: string | null;
  durationMs: number | null;
};

async function post(path: string, body?: unknown, token?: string) {
  const res = await fetch(`${base}${path}`, {
    method: "POST",
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}
async function get(path: string, token: string) {
  const res = await fetch(`${base}${path}`, { headers: { authorization: `Bearer ${token}` } });
  const text = await res.text();
  let parsed: any = null;
  try { parsed = text ? JSON.parse(text) : null; } catch { parsed = text; }
  return { status: res.status, body: parsed };
}
async function patch(path: string, body: unknown, token: string) {
  const res = await fetch(`${base}${path}`, {
    method: "PATCH",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

function connect(token: string): Socket {
  return ioClient(`${base}/signova`, {
    auth: { token },
    transports: ["websocket"],
    reconnection: false,
  });
}
function waitConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    if (socket.connected) return resolve();
    const t = setTimeout(() => reject(new Error("socket connect timeout")), 5000);
    socket.once("connect", () => { clearTimeout(t); resolve(); });
    socket.once("connect_error", (e) => { clearTimeout(t); reject(e); });
  });
}
function once<T>(socket: Socket, event: string, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => { socket.off(event, on); reject(new Error(`timeout waiting for ${event}`)); }, timeoutMs);
    const on = (payload: T) => { clearTimeout(t); socket.off(event, on); resolve(payload); };
    socket.on(event, on);
  });
}
async function waitAnimationFor(socket: Socket, timeoutMs: number): Promise<AnimationPayload> {
  for (;;) {
    const p = await once<AnimationPayload>(socket, "message:animation", timeoutMs);
    if (p.status === "ready" || p.status === "failed") return p;
  }
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

main()
  .then(async () => {
    const failed = results.filter((r) => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
    await new Promise<void>((r) => server.close(() => r()));
    await mongoose.disconnect();
    await mem.stop();
    process.exit(failed.length === 0 ? 0 : 1);
  })
  .catch(async (err) => {
    console.error("E2E ERROR:", err);
    try { await new Promise<void>((r) => server?.close(() => r())); } catch { /* noop */ }
    try { await mongoose.disconnect(); } catch { /* noop */ }
    try { await mem?.stop(); } catch { /* noop */ }
    process.exit(2);
  });
