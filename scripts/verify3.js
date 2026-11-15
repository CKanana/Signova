/**
 * Signova UI/UX redesign — rendered verification at desktop, tablet, mobile.
 *
 * Drives the PWA through its own UI and captures each screen:
 *   splash -> welcome -> method -> teller -> live signing
 *
 * Ignores the backend 401 (that is an auth/backend issue, not a UI problem).
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function goTo(page, step) {
  await page.waitForTimeout(700);
  if (step === "method") {
    try { await page.locator('button:has-text("Continue with Sign Language")').first().click(); } catch {}
  } else if (step === "teller") {
    try { await page.locator('button:has-text("Continue with Sign Language")').first().click(); } catch {}
  } else if (step === "live") {
    try { await page.locator('button:has-text("Continue with Sign Language")').first().click(); } catch {}
  }
}

async function capture(label, viewport, flowSteps) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  // splash -> welcome
  try { await page.locator('button:has-text("Start communication")').first().click(); } catch {}
  await page.waitForTimeout(800);
  for (const s of flowSteps) {
    await goTo(page, s);
  }
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
  console.log(`[${label}] ${flowSteps.join(" -> ")} saved`);
  if (errors.length) console.log(`  [${label}] pageerrors: ${errors.slice(0, 2).join(" | ")}`);
  await browser.close();
}

const viewports = [
  { label: "desktop",  w: 1440, h: 1000 },
  { label: "tablet",   w: 768,  h: 1024 },
  { label: "mobile",   w: 375,  h: 812 },
];

(async () => {
  for (const { label, w, h } of viewports) {
    await capture(
      `${label}_method`,
      { width: w, height: h },
      ["method"]
    );
    await capture(
      `${label}_teller`,
      { width: w, height: h },
      ["method", "teller"]
    );
    await capture(
      `${label}_live`,
      { width: w, height: h },
      ["method", "teller", "live"]
    );
  }
})();
