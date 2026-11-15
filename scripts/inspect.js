const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on("pageerror", e => errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });

  await page.goto("http://localhost:5175", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Splash -> welcome (the "Get started" button)
  try {
    await page.locator("button:has-text(\"Get started\")").first().click();
  } catch (e) { console.log("splash click err:", e.message); }
  await page.waitForTimeout(800);

  // welcome -> method (the "Choose how you'd like to communicate" heading + Sign Language CTA)
  try {
    await page.locator("text=Choose how you'd like to communicate").first().waitFor({ state: "visible", timeout: 8000 });
  } catch (e) { console.log("no method heading:", e.message); }
  // The Sign Language card's primary button
  try {
    await page.locator("button:has-text(\"Continue with Sign Language\")").first().click();
  } catch (e) { console.log("method select err:", e.message); }
  await page.waitForTimeout(1200);

  try {
    await page.locator("text=Choose a teller").first().waitFor({ state: "visible", timeout: 8000 });
    console.log("AT TELLER SCREEN ✓");
  } catch (e) {
    console.log("NOT AT TELLER:", e.message);
    try { console.log("body:", (await page.textContent("body")).slice(0, 400)); } catch {}
  }

  // scroll to reveal everything
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.waitForTimeout(500);
  await page.screenshot({ path: "screenshots/desktop_teller_verified.png", fullPage: false });
  console.log("pageerrors:", errors.length ? errors.join(" | ") : "none");

  await browser.close();
})();
