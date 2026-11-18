import { chromium } from "playwright";
const BASE = "http://localhost:5175";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(3000);
  console.log("=== BODY TEXT ===");
  console.log(await page.evaluate(() => document.body.innerText));
  console.log("=== BUTTONS ===");
  const btns = await page.evaluate(() => Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim()).filter(Boolean));
  console.log(JSON.stringify(btns, null, 2));
  console.log("=== VIDEO/CANVAS ===");
  const devs = await page.evaluate(() => {
    const rr = (s) => { const el = document.querySelector(s); if(!el) return null; const r = el.getBoundingClientRect(); return {tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height)}; };
    return { video: rr("video"), canvas: rr("canvas"), allCanvasCount: document.querySelectorAll("canvas").length };
  });
  console.log(JSON.stringify(devs, null, 2));
  console.log("=== JS ERRORS ===");
  console.log(errors.length ? errors.join("\n") : "(none)");
  await browser.close();
})();
