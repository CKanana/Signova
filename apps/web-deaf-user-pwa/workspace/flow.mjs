import { chromium } from "playwright";
const BASE = "http://localhost:5175";

async function clickText(page, text, timeout = 20000) {
  const el = page.locator(`button:has-text("${text}"), [role="button"]:has-text("${text}")`).first();
  await el.waitFor({ state: "visible", timeout });
  await el.click();
  await page.waitForTimeout(1500);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  page.on("requestfailed", (r) => { if (/5\d\d/.test(r.status())) errors.push("HTTP"+r.status()+": "+r.url()); });

  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(2000);

  // welcome -> method
  await clickText(page, "Start communication");
  await page.waitForTimeout(1200);
  // method -> tellers
  await clickText(page, "Continue with Sign Language");
  await page.waitForTimeout(800);
  // tellers -> connecting
  await clickText(page, "Connect");
  await page.waitForTimeout(6000); // allow session + socket + live screen to render

  const info = await page.evaluate(() => {
    const rr = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height) }; };
    const video = document.querySelector("video");
    const canvas = document.querySelector("canvas");
    return {
      step: document.body.innerText.slice(0, 120),
      buttons: document.querySelectorAll("button").length,
      video: rr("video"),
      canvas: rr("canvas"),
      allCanvasCount: document.querySelectorAll("canvas").length,
      hasCameraSurface: !!document.querySelector("[style*='background:#1E1B2E']"),
      errors: errors.length ? errors : "(none)",
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
