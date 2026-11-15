const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function capture(label, viewport, fullPage = true) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage });
  await browser.close();
  console.log(`Saved ${OUT}/${label}.png (${viewport.width}x${viewport.height})`);
}

const viewports = {
  desktop: { width: 1440, height: 1000 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 375, height: 812 },
};

(async () => {
  for (const [label, vp] of Object.entries(viewports)) {
    await capture(`${label}_method`, vp);
    await capture(`${label}_teller`, vp);
    // Live signing is a full-page capture from a fresh nav
    const browser = await chromium.launch({ headless: true });
    const p = await browser.newPage({ viewport: vp });
    await p.goto(BASE, { waitUntil: "networkidle" });
    await p.waitForTimeout(800);
    // Navigate to the live signing step via the URL route if it exists
    await p.goto(BASE + "/live", { waitUntil: "networkidle", waitUntil: "networkidle" }).catch(() => {});
    await p.waitForTimeout(1500);
    await p.screenshot({ path: `${OUT}/${label}_live.png`, fullPage: true });
    await browser.close();
    console.log(`Saved ${OUT}/${label}_live.png (${vp.width}x${vp.height})`);
  }
})();
