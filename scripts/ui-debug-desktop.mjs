import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const cfg = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "signova_ui_session.json"), "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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
page.on("response", (r) => {
  if (r.url().includes("/api/")) console.log("RESP", r.status(), r.url());
});
page.on("console", (m) => { if (m.type() === "error") console.log("CONSOLE", m.text().slice(0, 160)); });
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
await page.goto("http://localhost:5175/text", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
console.log("URL", page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2000));
await page.screenshot({ path: path.join(os.tmpdir(), "signova-ui-debug-desktop.png"), fullPage: true });
await browser.close();
