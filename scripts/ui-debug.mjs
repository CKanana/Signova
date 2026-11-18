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
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text()));
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("requestfailed", (r) => console.log("REQFAIL", r.url(), r.failure()?.errorText));
page.on("response", (r) => {
  if (r.url().includes("/animation") || r.url().includes("/messages") || r.url().includes("/socket.io"))
    console.log("RESP", r.status(), r.url());
});
await page.goto("http://localhost:5175/text", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
const info = await page.evaluate(() => ({
  url: location.href,
  bodyText: document.body.innerText.slice(0, 2500),
  videos: Array.from(document.querySelectorAll("video")).map((v) => ({
    src: (v.currentSrc || v.src || "").slice(0, 80),
    readyState: v.readyState,
    width: v.videoWidth,
    error: v.error ? v.error.code + ":" + v.error.message : null,
  })),
  hasAnimationBlock: !!document.querySelector("video"),
}));
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: path.join(os.tmpdir(), "signova-ui-debug.png"), fullPage: true });
await browser.close();
