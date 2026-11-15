/**
 * Verify the Signova UI/UX redesign by navigating through the app's own UI
 * and capturing each screen at desktop, tablet, and mobile.
 *
 * Flow: splash -> welcome -> method -> teller -> live
 * Ignores backend 401 (auth context) since the UI renders before the API call
 * for the initial org/tellers load completes.
 */
const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

async function gotoMethod(page) {
  // splash -> welcome
  await page.waitForTimeout(800);
  try { await page.locator("button:has-text(\"Get started\")").first().click(); } catch {}
  await page.waitForTimeout(800);
  // welcome -> method (Start communication)
  try { await page.locator("button:has-text(\"Start communication\")").first().click(); } catch {}
  await page.waitForTimeout(800);
}

async function gotoTeller(page) {
  await page.waitForTimeout(700);
  // method -> teller (Continue with Sign Language on the sign card)
  try { await page.locator("button:has-text(\"Continue with Sign Language\")").first().click(); } catch {}
  await page.waitForTimeout(1200);
  try { await page.locator("text=Choose a teller").first().waitFor({ state: "visible", timeout: 8000 }); }
  catch (e) { console.log("  NOT at teller:", e.message.split("\n")[0]); }
}

async function gotoLive(page) {
  await page.waitForTimeout(700);
  try { await page.locator("button:has-text(\"Continue with Sign Language\")").first().click(); } catch {}
  await page.waitForTimeout(1500);
  try { await page.locator("text=Position your hands").first().waitFor({ state: "visible", timeout: 8000 }); }
  catch (e) { console.log("  NOT at live:", e.message.split("\n")[0]); }
}

const viewports = [
  { label: "desktop",  w: 1440, h: 1000 },
  { label: "tablet",   w: 768,  h: 1024 },
  { label: "mobile",   w: 375,  h: 812 },
];

(async () => {
  for (const { label, w, h } of viewports) {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    const pageErrors = [];
    page.on("pageerror", e => pageErrors.push(e.message));
    page.on("console", m => { if (m.type() === "error") pageErrors.push(m.text()); });

    // ---- METHOD ----
    await page.goto(BASE, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    try { await page.locator("button:has-text(\"Get started\")").first().click(); } catch {}
    await page.waitForTimeout(800);
    try { await page.locator("button:has-text(\"Start communication\")").first().click(); } catch {}
    await page.waitForTimeout(800);
    try { await page.locator("button:has-text(\"Continue with Sign Language\")").first().click(); } catch {}
    await page.waitForTimeout(1200);
    try { await page.locator("text=Choose how you'd like to communicate").first().waitFor({ state: "visible", timeout: 8000 }); }
    catch (e) { console.log(`[${label}] method: ${e.message.split("\n")[0]}`); }
    await page.screenshot({ path: `screenshots/${label}_method.png`, fullPage: true });
    console.log(`[${label}] method  saved`);

    // ---- TELLER ----
    await page.waitForTimeout(600);
    try { await page.locator("button:has-text(\"Continue with Sign Language\")").first().click(); } catch {}
    await page.waitForTimeout(1200);
    try { await page.locator("text=Choose a teller").first().waitFor({ state: "visible", timeout: 8000 }); }
    catch (e) { console.log(`[${label}] teller: ${e.message.split("\n")[0]}`); }
    await page.screenshot({ path: `screenshots/${label}_teller.png`, fullPage: true });
    console.log(`[${label}] teller  saved`);

    // ---- LIVE SIGNING ----
    await page.waitForTimeout(600);
    try { await page.locator("button:has-text(\"Continue with Sign Language\")").first().click(); } catch {}
    await page.waitForTimeout(1500);
    try { await page.locator("text=Position your hands").first().waitFor({ state: "visible", timeout: 8000 }); }
    catch (e) { console.log(`[${label}] live: ${e.message.split("\n")[0]}`); }
    await page.screenshot({ path: `screenshots/${label}_live.png`, fullPage: true });
    console.log(`[${label}] live    saved`);

    // capture page errors for the session
    if (pageErrors.length) console.log(`[${label}] pageerrors: ${pageErrors.slice(0, 3).join(" | ")}`);

    await browser.close();
  }
})();
