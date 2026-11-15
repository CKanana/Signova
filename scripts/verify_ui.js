/**
 * Navigation + screenshot verification for the Signova UI/UX redesign.
 *
 * Drives the PWA through its own UI (splash -> welcome -> method -> teller ->
 * live signing) rather than poking the session context directly, so the rendered
 * result reflects real component composition and CSS.
 *
 * The app's session step is driven by SessionContext; the app provides Back /
 * help / accessibility buttons on every screen.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function gotoMethod(page) {
  // Splash is the first screen. Click "Get started" or the visible CTA to reach
  // the welcome screen, then find the method selection CTA.
  await page.waitForTimeout(800);
  // Splash -> welcome
  await page.locator("button:has-text(\"Get started\")").first().click().catch(async () => {
    // some apps point straight to welcome
    await page.locator("button:has-text(\"Start\")").first().click().catch(() => {});
  });
  await page.waitForTimeout(700);
  // welcome -> method (wordmark / brand link)
  await page.locator("text=Choose how you'd like to communicate").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
  // Click the method screen entry point (a link/button containing "Sign Language")
  try {
    await page.locator("button:has-text(\"Continue with Sign Language\")").first().click();
  } catch {
    try {
      await page.locator("a:has-text(\"Sign Language\")").first().click();
    } catch {
      // skip navigation if we're already on method
    }
  }
  await page.waitForTimeout(1000);
}

async function gotoTellers(page) {
  await page.waitForTimeout(900);
  try {
    // Back from method to welcome, then the current-step entry is via the
    // already-open method screen. Click "Continue with Sign Language" again
    // won't help; instead click the tellers CTA (or re-enter method and back).
    await page.locator("button:has-text(\"Continue with Sign Language\")").first().click().catch(() => {});
  } catch {}
  await page.waitForTimeout(1200);
  // Wait for the teller selection heading
  await page.locator("text=Choose a teller").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
}

async function gotoLive(page) {
  await page.waitForTimeout(900);
  // Click a "Continue with Sign Language" or live CTA to reach the camera step
  await page.locator("button:has-text(\"Continue with Sign Language\")").first().click().catch(() => {});
  await page.waitForTimeout(1500);
  await page.locator("text=Position your hands").first().waitFor({ state: "visible", timeout: 8000 }).catch(() => {});
}

async function capture(label, viewport, fullPage = true, extraGoto) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if (extraGoto) await extraGoto(page);
  await page.waitForTimeout(1400);
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
    // ---- Method selection screen ----
    await capture(`${label}_method`, vp, true, gotoMethod);

    // ---- Teller selection screen ----
    await capture(`${label}_teller`, vp, true, gotoTellers);

    // ---- Live signing screen ----
    await capture(`${label}_live`, vp, true, gotoLive);
  }
})();
