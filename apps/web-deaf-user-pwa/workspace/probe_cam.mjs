import { chromium } from "playwright";
const BASE = "http://localhost:5175";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, locale: "en-US" });
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 45000 });
  await page.waitForTimeout(6000);
  const info = await page.evaluate(() => {
    const rr = (s) => { const el = document.querySelector(s); if (!el) return null; const r = el.getBoundingClientRect(); return { tag: el.tagName, w: Math.round(r.width), h: Math.round(r.height) }; };
    const video = document.querySelector("video");
    const canvas = document.querySelector("canvas");
    return {
      buttons: document.querySelectorAll("button").length,
      video: rr("video"),
      canvas: rr("canvas"),
      allCanvasCount: document.querySelectorAll("canvas").length,
      bodyText: document.body.innerText.slice(0, 300),
      errors: [],
      headTitle: document.querySelector("title")?.textContent,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
