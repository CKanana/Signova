const { chromium } = require("playwright");

const BASE = "http://localhost:5175";
const OUT = "screenshots";

// Drive directly to the method screen and inspect the redesigned classes
async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });

  await page.goto(BASE, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);

  // splash -> welcome
  await page.click('button:has-text("Start communication")', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
  // welcome -> method
  await page.click('button:has-text("Choose how you would like to communicate")', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);

  const state = await page.evaluate(() => {
    const card = document.querySelector('[style*="borderRadius: 28"]');
    const methods = [];
    document.querySelectorAll('[style*="borderRadius: 28"]').forEach((c, i) => {
      methods.push({ i, text: c.innerText.trim().slice(0, 30) });
    });
    return {
      methodScreen: {
        title: document.querySelector('h1').innerText,
        cards: methods,
        buttons: Array.from(document.querySelectorAll("button")).map(b => b.innerText.trim().slice(0, 30)),
        hasGap: getComputedStyle(document.querySelector('.sn-method-cards') || document.body).getPropertyValue('gap'),
        cardBorderRadius: getComputedStyle(document.querySelector('[style*="borderRadius: 28"]') || null).getPropertyValue('border-radius'),
      },
    };
  });
  console.log(JSON.stringify(state, null, 2));
  await browser.close();
}

main().catch(e => { console.error(e); process.exit(1); });
