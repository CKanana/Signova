import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on("console", m => { if (m.type() === "error") console.error("PAGE:", m.text()); });
await page.goto("http://localhost:5199/workspace/model-contract.html", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => document.getElementById("out")?.textContent !== "running…", null, { timeout: 120000 });
console.log(await page.locator("#out").innerText());
await browser.close();
