const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // Load the app
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // 1) Tokens on :root
  const tokens = await page.evaluate(() => {
    const root = document.documentElement;
    const props = [
      "--signova-primary", "--signova-on-primary", "--signova-cornsilk-soft",
      "--signova-border", "--signova-text", "--signova-muted-text",
      "--signova-background", "--signova-radius-control", "--signova-spacing-md",
      "--signova-safe-bottom", "--signova-shadow-soft", "--signova-success",
      "--signova-danger", "--signova-warning", "--signova-primary-soft", "--signova-success-soft",
    ];
    const out = {};
    props.forEach((p) => { out[p] = getComputedStyle(root).getPropertyValue(p); });
    return out;
  });

  // 2) Shared components used
  const components = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      hasSignovaButton: !!document.querySelector('.sn-button'),
      hasStatusBadge: !!document.querySelectorAll('.sn-badge, [role="status"]').length,
      hasAvatar: !!document.querySelector('.sn-avatar'),
      hasBanner: !!document.querySelector('.sn-banner'),
      hasHeader: !!document.querySelector('.sn-header'),
      hasStatusRing: !!document.querySelector('.sn-status-ring'),
      hasPill: !!document.querySelector('.sn-pill'),
      bodyTextSample: document.body.innerText.slice(0, 200),
    };
  });

  // 3) CSS files injected
  const sheets = await page.evaluate(() =>
    Array.from(document.styleSheets).map(s => s.href).filter(Boolean));

  console.log("TOKENS:\n" + JSON.stringify(tokens, null, 2));
  console.log("\nCOMPONENTS:\n" + JSON.stringify(components, null, 2));
  console.log("\nSHEETS:\n" + JSON.stringify(sheets));

  await browser.close();
})();
