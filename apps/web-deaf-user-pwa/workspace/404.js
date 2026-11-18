import { chromium } from "playwright";
const BASE = "http://localhost:5175";
(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("requestfailed", (req) => console.log("FAIL:", req.url(), req.failure()?.type));
  page.on("response", (res) => { if (res.status() >= 400) console.log("HTTP", res.status(), res.url()); });
  await page.goto(BASE, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(2000);
  // preload all assets
  const list = await page.evaluate(async () => {
    const urls = [];
    for (const img of document.querySelectorAll("img")) urls.push(img.src);
    for (const link of document.querySelectorAll("link[rel='stylesheet']")) urls.push(link.href);
    for (const s of document.querySelectorAll("script[type='module']")) urls.push(s.src);
    const done = await Promise.all(urls.map(async (u) => { try { const r = await fetch(u); return [u, r.status]; } catch { return [u, "ERR"]; } }));
    return Object.fromEntries(done);
  });
  console.log("ASSET STATUS:", JSON.stringify(list, null, 2));
  await browser.close();
})();
