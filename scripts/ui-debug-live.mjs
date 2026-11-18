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
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 200)));
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("requestfailed", (r) => console.log("REQFAIL", r.url(), r.failure()?.errorText));
page.on("response", (r) => {
  if (r.url().includes("/animation") || r.url().includes("/messages") || r.url().includes("/pose"))
    console.log("RESP", r.status(), r.url());
});
await page.goto("http://localhost:5175/text", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(4000);
console.log("--- before send ---");
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 800));

const res = await fetch(`http://localhost:4000/api/sessions/${cfg.sessionId}/messages`, {
  method: "POST",
  headers: { authorization: `Bearer ${cfg.staffToken}`, "content-type": "application/json" },
  body: JSON.stringify({ sender: "STAFF", text: "Can you write this down for me?", method: "speech" }),
});
console.log("send status", res.status, await res.text());

for (const ms of [2000, 4000, 10000, 25000]) {
  await page.waitForTimeout(ms === 2000 ? 2000 : ms - (ms === 4000 ? 2000 : ms === 10000 ? 4000 : 10000));
  const info = await page.evaluate(() => ({
    url: location.href,
    text: document.body.innerText.slice(0, 1200),
    videos: document.querySelectorAll("video").length,
    avatarStage: document.querySelectorAll(".sn-avatar-stage").length,
    avatarLoading: document.querySelectorAll(".sn-avatar-loading").length,
    pendingText: document.querySelectorAll("text=Preparing").length,
  }));
  console.log(`--- t+${ms}ms ---`);
  console.log(JSON.stringify(info, null, 2));
}
await page.screenshot({ path: path.join(os.tmpdir(), "signova-ui-debug-live.png"), fullPage: true });
await browser.close();
