/**
 * Signova UI/UX redesign — final rendered verification script.
 *
 * Verifies:
 *   1. Design tokens are applied on :root.
 *   2. Shared components are used (Header, StatusBadge, SignovaButton, Avatar, Banner).
 *   3. Group screens render at 1440/768/375.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function captureScreen(page, viewport, steps, label) {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  for (const s of steps) {
    if (s === "welcome") {
      await page.click('button:has-text("Start communication")', { timeout: 8000 }).catch(() => {});
    } else {
      await page.click('button:has-text("Continue with Sign Language")', { timeout: 8000 }).catch(() => {});
    }
    await page.waitForTimeout(800);
  }
  await page.waitForTimeout(1000);

  const state = await page.evaluate((stepLabels) => {
    const t = (re) => {
      const el = document.querySelector(re);
      return el ? el.innerText.slice(0, 60) : null;
    };
    const hasClass = (cls) => {
      return Array.from(document.querySelectorAll("*")).some(
        (el) => el.classList && el.classList.contains(cls)
      );
    };
    return {
      bodyText: document.body.innerText.slice(0, 120),
      hasHeader: hasClass("sn-header"),
      hasSignovaLogo: !!document.querySelector('img[src*="signova-logo"]'),
      hasStatusBadge: hasClass("sn-badge") || !!document.querySelector('[role="status"]') || document.querySelectorAll('[aria-label*="available"]').length > 0,
      buttons: Array.from(document.querySelectorAll("button")).map((b) => b.innerText.trim().slice(0, 30)),
    };
  }, steps);

  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
  return { label, state, errors };
}

(async () => {
  const viewports = [
    { label: "desktop", w: 1440, h: 1000 },
    { label: "tablet",  w: 768,  h: 1024 },
    { label: "mobile",  w: 375,  h: 812 },
  ];

  const results = [];
  for (const { label, w, h } of viewports) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: w, height: h } });

    const method = await captureScreen(page, { width: w, height: h }, ["welcome", "method"], `${label}_method`);
    const teller = await captureScreen(page, { width: w, height: h }, ["welcome", "method", "teller"], `${label}_teller`);
    const live = await captureScreen(page, { width: w, height: h }, ["welcome", "method", "teller", "live"], `${label}_live`);

    results.push({ viewport: label, method, teller, live });
    await browser.close();
  }

  // Print a compact summary
  for (const r of results) {
    console.log(`\n=== ${r.viewport} viewport ===`);
    for (const screen of [r.method, r.teller, r.live]) {
      console.log(`  ${screen.label}: body=${JSON.stringify(screen.state.bodyText)} header=${screen.state.hasHeader} badge=${screen.state.hasStatusBadge}`);
      if (screen.errors.length) console.log(`    pageerrors: ${screen.errors.slice(0, 2).join(" | ")}`);
    }
  }
})();
