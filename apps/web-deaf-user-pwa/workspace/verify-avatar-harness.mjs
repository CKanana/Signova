import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error") errors.push(`console: ${message.text()}`);
});
await page.goto("http://localhost:8090/", { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
const info = await page.evaluate(() => ({
  title: document.title,
  svgCount: document.querySelectorAll("svg").length,
  paths: document.querySelectorAll("svg path").length,
  circles: document.querySelectorAll("svg circle").length,
  bodyText: document.body.innerText.slice(0, 400),
  svgBox: document.querySelector("svg")?.getBoundingClientRect().toJSON(),
}));
await page.screenshot({ path: "workspace/avatar-harness.png", fullPage: true });
console.log(JSON.stringify({ info, errors }, null, 2));
await browser.close();
