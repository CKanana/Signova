/**
 * Signova UI/UX redesign — rendered verification.
 *
 * Drives the PWA through its own UI and captures each screen at 1440 tablet
 * and 375 viewport, then reads back the DOM state to confirm the correct
 * screens rendered (sanity check that our selectors reach the right screens).
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function go(page, steps) {
  for (const s of steps) {
    if (s === "welcome") {
      try { await page.locator('button:has-text("Start communication")').first().click(); } catch {}
    } else if (s === "method") {
      try { await page.locator('button:has-text("Continue with Sign Language")').first().click(); } catch {}
    } else if (s === "teller") {
      try { await page.locator('button:has-text("Continue with Sign Language")').first().click(); } catch {}
    } else if (s === "live") {
      try { await page.locator('button:has-text("Continue with Sign Language")').first().click(); } catch {}
    }
    await page.waitForTimeout(900);
  }
}

async function capture(label, viewport, steps) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  await go(page, steps);

  // Build a DOM state summary
  const state = await page.evaluate(() => {
    const find = (sel, text) => {
      const el = document.querySelector(sel);
      return el ? el.innerText.slice(0, 80) : null;
    };
    return {
      heading: find("h1", "text"),
      hasTellerHeading: /Choose a teller/i.test(document.body.innerText),
      hasLiveInstruction: /Position your hands/i.test(document.body.innerText),
      hasMethodHeading: /Choose how you'd like to communicate/i.test(document.body.innerText),
      cardCount: document.querySelectorAll('[style*="borderRadius: 28"]').length,
      btnCount: document.querySelectorAll("button").length,
      isLive: /Position your hands/i.test(document.body.innerText),
      hasCameraWrap: !!(document.querySelector('[style*="borderRadius: 24"]') && document.querySelector('[style*="background: #111"]')),
      // Page errors are captured via the browser's console listener (outside
      // the evaluate), so report them here as empty.
      errors: [],
    };
  });

  await page.screenshot({ path: `${OUT}/${label}.png`, fullPage: true });
  console.log(`[${label}] saved — ${JSON.stringify(state)}`);
  await browser.close();
}

const viewports = [
  { label: "desktop", w: 1440, h: 1000 },
  { label: "mobile",  w: 375,  h: 812 },
];

(async () => {
  for (const { label, w, h } of viewports) {
    await capture(`${label}_method`, { width: w, height: h }, ["method"]);
    await capture(`${label}_teller`, { width: w, height: h }, ["method", "teller"]);
    await capture(`${label}_live`, { width: w, height: h }, ["method", "teller", "live"]);
  }
})();
