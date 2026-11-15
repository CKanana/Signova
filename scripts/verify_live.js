const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function gotoLive(page) {
  await page.waitForTimeout(800);
  try {
    await page.locator("button:has-text(\"Continue with Sign Language\")").first().click();
  } catch {}
  await page.waitForTimeout(1500);
  await page.locator("text=Position your hands").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
}

const viewports = {
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1440, height: 1000 },
};

(async () => {
  for (const [label, vp] of Object.entries(viewports)) {
    const browser = await chromium.launch({ headless: true });
    const p = await browser.newPage({ viewport: vp });
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    await gotoLive(p);
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${label}_live.png`, fullPage: true });
    await browser.close();
    console.log(`Saved ${OUT}/${label}_live.png (${vp.width}x${vp.height})`);
  }
})();
