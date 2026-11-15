/**
 * Signova UI/UX redesign — rendered verification (part 2: tokens + components).
 *
 * Runs as a standalone Node script: `node scripts/verify_tokens.js`.
 * Prints JSON of token values and redesigned-component presence per screen.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function run() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);

  // 1) Tokens applied
  const tokens = await page.evaluate(() => {
    const root = document.documentElement;
    const props = [
      "--signova-primary", "--signova-on-primary", "--signova-cornsilk-soft",
      "--signova-border", "--signova-text", "--signova-muted-text",
      "--signova-background", "--signova-radius-control", "--signova-spacing-md",
      "--signova-safe-bottom", "--signova-shadow-soft", "--signova-success",
      "--signova-danger", "--signova-warning",
    ];
    const out = {};
    props.forEach((p) => { out[p] = getComputedStyle(root).getPropertyValue(p); });
    return out;
  });

  // 2) Redesigned tokens CSS injected
  const stylesheets = await page.evaluate(() =>
    Array.from(document.styleSheets).map((s) => s.href).filter(Boolean));

  // 3) Components used in the current screen (splash/welcome)
  const dom = await page.evaluate(() => {
    const bodyText = document.body.innerText;
    return {
      bodyText: bodyText.slice(0, 200),
      hasSignovaLogo: !!document.querySelector('img[src*="signova-logo"]'),
      hasCards: document.querySelectorAll('[style*="borderRadius: 28"]').length,
      hasButtons: document.querySelectorAll("button").length,
    };
  });

  console.log(JSON.stringify({ tokens, stylesheets, dom }, null, 2));
  await browser.close();
}

run().catch((e) => { console.error(e); process.exit(1); });
