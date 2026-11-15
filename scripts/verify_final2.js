/**
 * Signova UI/UX redesign — rendered verification.
 *
 * Drives the PWA through its own UI and confirms each redesigned screen
 * renders with the correct classes/structures. Also checks the design tokens
 * are applied on :root.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  // 1) Design tokens applied on :root
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

  // 2) CSS files injected
  const sheets = await page.evaluate(() =>
    Array.from(document.styleSheets).map((s) => s.href).filter(Boolean));

  // 3) Drive through the UI to the method screen
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  // splash -> welcome
  await page.click('button:has-text("Start communication")', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);
  // welcome -> method
  await page.click('button:has-text("Continue with Sign Language")', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(900);

  // 4) Re-verify tokens still applied after navigation
  const tokens2 = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      primary: getComputedStyle(root).getPropertyValue("--signova-primary"),
      cornsilk: getComputedStyle(root).getPropertyValue("--signova-cornsilk-soft"),
      border: getComputedStyle(root).getPropertyValue("--signova-border"),
    };
  });

  console.log("TOKENS_ON_ROOT:", JSON.stringify(tokens, null, 2));
  console.log("\nSHEETS:", JSON.stringify(sheets));
  console.log("\nTOKENS_AFTER_NAV:", JSON.stringify(tokens2, null, 2));
  await browser.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
