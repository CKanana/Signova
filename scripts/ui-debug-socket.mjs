import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const cfg = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "signova_ui_session.json"), "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
await context.addInitScript(
  ({ token, deviceId, session }) => {
    localStorage.setItem("signova.accessToken", token);
    localStorage.setItem("signova.device.id.v1", deviceId);
    localStorage.setItem("signova.session", JSON.stringify(session));
  },
  {
    token: cfg.deafToken,
    deviceId: cfg.deviceId,
    session: { sessionId: cfg.sessionId, tellerId: cfg.tellerId, method: "text", createdAt: Date.now() },
  },
);
const page = await context.newPage();
page.on("websocket", (ws) => {
  console.log("WS OPEN", ws.url());
  ws.on("framesent", (f) => console.log("WS SENT", typeof f === "string" ? f : f.length));
  ws.on("framereceived", (f) => console.log("WS RECV", typeof f === "string" ? f.slice(0, 500) : f.length));
  ws.on("close", () => console.log("WS CLOSE", ws.url()));
  ws.on("socketerror", (e) => console.log("WS ERR", e));
});
page.on("console", (m) => {
  if (m.type() !== "debug") console.log("CONSOLE", m.type(), m.text().slice(0, 200));
});
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://localhost:5175/text", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
console.log("--- send ---");
const r = await fetch(`http://localhost:4000/api/sessions/${cfg.sessionId}/messages`, {
  method: "POST",
  headers: { authorization: `Bearer ${cfg.staffToken}`, "content-type": "application/json" },
  body: JSON.stringify({ sender: "STAFF", text: "Where is the customer service desk?", method: "speech" }),
});
console.log("send", r.status);
await page.waitForTimeout(6000);
console.log("--- body ---");
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 1500));
await browser.close();
