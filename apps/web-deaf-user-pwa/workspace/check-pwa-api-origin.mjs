import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const apiRequests = [];
page.on("request", (req) => {
  if (req.url().includes("/api/") || req.url().includes("/socket.io")) apiRequests.push(req.url());
});
await page.goto("http://localhost:5175/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(3000);
console.log(JSON.stringify({ apiRequests: [...new Set(apiRequests)], title: await page.title() }, null, 2));
await browser.close();
