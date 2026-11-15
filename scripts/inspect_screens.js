const { chromium } = require("playwright");

/**
 * Run a single verification: navigate to a specific screen and return its
 * computed style of key elements. This keeps the browser session short
 * and avoids the 401/backend issues that block full-session flow.
 */
async function inspectScreen(screen, viewport = { width: 1440, height: 1000 }) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.goto("http://localhost:5175", { waitUntil: "networkidle" });
  await page.waitForTimeout(600);

  // splash -> welcome -> screen
  try { await page.click('button:has-text("Start communication")', { timeout: 8000 }).catch(() => {}); } catch {}
  await page.waitForTimeout(700);
  if (screen === "method") {
    await page.click('button:has-text("Continue with Sign Language")', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(800);
  } else if (screen === "teller") {
    await page.click('button:has-text("Continue with Sign Language")', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1100);
  } else if (screen === "live") {
    await page.click('button:has-text("Continue with Sign Language")', { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(1300);
  }

  const result = await page.evaluate(() => {
    const root = document.documentElement;
    const cs = (el) => el ? getComputedStyle(el) : null;
    const get = (re, ctx = document.body) => {
      const el = ctx.querySelector(re);
      return el ? cs(el).color : null;
    };
    return {
      rootColors: {
        "--signova-primary": cs(root).getPropertyValue("--signova-primary").trim(),
        "--signova-text": cs(root).getPropertyValue("--signova-text").trim(),
        "--signova-text-strong": cs(root).getPropertyValue("--signova-text-strong").trim(),
        "--signova-primary-soft": cs(root).getPropertyValue("--signova-primary-soft").trim(),
      },
      elements: {
        methodHeadingColor: document.querySelector('h1') ? cs(document.querySelector('h1')).color : null,
        methodTitleText: document.querySelector('h1') ? document.querySelector('h1').innerText : null,
        methodSubtitle: document.querySelector('p[style*="fontSize"]') ? cs(document.querySelector('p[style*="fontSize"]')).color : null,
        watcher: document.querySelectorAll('h1').length > 0,
      },
      bodyText: document.body.innerText.slice(0, 200),
    };
  });
  await browser.close();
  return result;
}

(async () => {
  for (const s of ["method", "teller", "live"]) {
    console.log(`\n=== ${s} screen ===`);
    const r = await inspectScreen(s);
    console.log(JSON.stringify(r, null, 2));
  }
})();
