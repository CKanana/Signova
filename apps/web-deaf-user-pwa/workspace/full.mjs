import { chromium } from "playwright";
const BASE = "http://localhost:5175";

async function clickAndReport(page, label, selector) {
  try {
    await page.locator(selector).first().click();
    await page.waitForTimeout(800);
    console.log(">>> " + label);
  } catch (e) { console.log(">>> " + label + " FAILED: " + e.message.split("\n")[0]); }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);

  await clickAndReport(page, "welcome->method", 'button:has-text("Start communication")');
  await page.waitForTimeout(600);
  await clickAndReport(page, "method->tellers", 'button:has-text("Continue")');
  await page.waitForTimeout(1200);
  await clickAndReport(page, "tellers->connecting", 'button:has-text("Connect")');
  await page.waitForTimeout(4000);

  const d1 = await page.evaluate(() => {
    const q = (s) => document.querySelectorAll(s);
    return { step: document.querySelector("[role=progress]") ? "progress shown" : "n/a", bodyChildren: document.body.children.length };
  });
  console.log("AFTER CONNECTING:", JSON.stringify(d1));

  const mold = await page.evaluate(() => {
    const q = (s) => document.querySelectorAll(s);
    return { video: q("video")[0] ? "video present" : "none", canvas: q("canvas")[0] ? "canvas present" : "none" };
  });
  console.log("AFTER CONNECT:", JSON.stringify(mold));
  await clickAndReport(page, "connecting->ready", 'button:has-text("Start signing")');
  await page.waitForTimeout(2500);
  const d2 = await page.evaluate(() => {
    const q = (s) => document.querySelectorAll(s);
    const video = q("video")[0];
    const canvas = q("canvas")[0];
    return {
      video: video ? { w: video.offsetWidth, h: video.offsetHeight, rect: video.getBoundingClientRect() } : "none",
      canvas: canvas ? { w: canvas.offsetWidth, h: canvas.offsetHeight } : "none",
      bodyChildren: document.body.children.length,
    };
  });
  console.log("AFTER READY:", JSON.stringify(d2));
  console.log("JS ERRORS:", errors.length ? errors : "(none)");
  await browser.close();
})();
