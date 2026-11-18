import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const cfg = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "signova_staff_ui.json"), "utf8"));
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
await context.addInitScript(
  ({ token, user }) => {
    sessionStorage.setItem("signova.staff.accessToken", token);
    sessionStorage.setItem("signova.staff.refreshToken", "audit-refresh-token");
    sessionStorage.setItem("signova.staff.user", JSON.stringify(user));
  },
  { token: cfg.staffToken, user: cfg.staffUser },
);
const page = await context.newPage();
page.on("console", (m) => console.log("CONSOLE", m.type(), m.text().slice(0, 250)));
page.on("pageerror", (e) => console.log("PAGEERROR", e.message));
page.on("requestfailed", (r) => console.log("REQFAIL", r.url(), r.failure()?.errorText));
page.on("response", (r) => {
  if (r.url().includes("/api/")) console.log("RESP", r.status(), r.url());
});
await page.goto("http://localhost:5173/staff/session", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(8000);
console.log("URL", page.url());
console.log((await page.evaluate(() => document.body.innerText)).slice(0, 2500));
await page.screenshot({ path: path.join(os.tmpdir(), "signova-staff-debug.png"), fullPage: true });
await browser.close();
