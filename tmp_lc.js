// Confirm lineHeight unitless multiplication and heading/cards heights.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.locator('button:has-text("Start communication")').first().click();
  await page.waitForTimeout(2500);

  const result = await page.evaluate(() => {
    const el = (sel) => document.querySelector(sel);
    const info = (el, label) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { label, tag: el.tagName, cls: (el.className||'').slice(0,50),
        display: cs.display, flexDir: cs.flexDirection, height: cs.height, width: cs.width,
        lineHeight: cs.lineHeight, fontSize: cs.fontSize, marginTop: cs.marginTop, marginBottom: cs.marginBottom,
        paddingTop: cs.paddingTop, paddingBottom: cs.paddingBottom,
        rect: r ? { top: r.top, left: r.left, w: r.width, h: r.height } : null };
    };
    const heading = el('.heading') || el('#root > div > div > div > div > div:nth-child(3)'); // fallback
    // Find heading as div containing eyebrow h1
    const headingEl = Array.from(document.querySelectorAll('#root div')).find(d => d.querySelector('.eyebrowRow') && d.querySelector('.title') && d.querySelector('.subtitle'));
    return {
      heading: headingEl ? info(headingEl, 'heading') : null,
      h1: info(el('.title'), 'title'),
      subtitle: info(el('.subtitle'), 'subtitle'),
      topBar: info(el('.topBar'), 'topBar'),
      cardsContainer: info(el('.cardsContainer'), 'cardsContainer'),
      card1: info(el('button').firstElementChild, 'card1') || null,
      card1rect: el('button').firstElementChild ? el('button').firstElementChild.getBoundingClientRect() : null,
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
