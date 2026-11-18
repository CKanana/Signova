import { chromium } from "playwright";
const BASE = "http://localhost:5175";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const jsErrors = [];
  page.on("pageerror", (e) => jsErrors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") jsErrors.push("console.error: " + m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 30000 });
  await page.waitForTimeout(2500);

  const dom = await page.evaluate(() => {
    const q = (s) => document.querySelectorAll(s);
    const video = q("video")[0];
    const canvas = q("canvas")[0];
    const root = document.getElementById("root");
    return {
      childNodes: root ? root.childNodes.length : -1,
      children: root ? root.children.length : -1,
      video: video ? { display: getComputedStyle(video).display, width: video.offsetWidth, height: video.offsetHeight, rect: video.getBoundingClientRect() } : "none",
      canvas: canvas ? { display: getComputedStyle(canvas).display, width: canvas.width, height: canvas.height, cssWidth: canvas.offsetWidth, cssHeight: canvas.offsetHeight } : "none",
      h1: q("h1")[0] ? q("h1")[0].textContent : "",
    };
  });
  console.log("DOM:", JSON.stringify(dom, null, 2));
  console.log("JS ERRORS:", jsErrors.length ? jsErrors : "(none)");

  // Navigate to live: click Continue with Sign Language, then Position your hands
  try {
    await page.locator('button:has-text("Continue with Sign Language")').first().click();
    await page.waitForTimeout(1200);
    await page.locator("text=Position your hands").first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log("nav-err:", e.message);
  }

  const dom2 = await page.evaluate(() => {
    const q = (s) => document.querySelectorAll(s);
    const video = q("video")[0];
    const canvas = q("canvas")[0];
    return {
      video: video ? { display: getComputedStyle(video).display, width: video.offsetWidth, height: video.offsetHeight, rect: video.getBoundingClientRect() } : "none",
      canvas: canvas ? { display: getComputedStyle(canvas).display, width: canvas.width, height: canvas.height, cssWidth: canvas.offsetWidth, cssHeight: canvas.offsetHeight } : "none",
    };
  });
  console.log("DOM2:", JSON.stringify(dom2, null, 2));
  await page.screenshot({ path: "workspace/live_blank.png", fullPage: true });
  await browser.close();
})();
