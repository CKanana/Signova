// Dump parent/child chain with computed display, height, position, z-index for the card elements and their ancestors.
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
    function getAncestors(el) {
      var arr = [];
      while (el) { arr.push(el); el = el.parentElement; }
      return arr;
    }
    // Find the two method-card buttons
    const cards = [...document.querySelectorAll('button')].filter(b => b.textContent.trim().startsWith('Sign language') || b.textContent.trim().startsWith('Text'));
    const out = [];
    for (const card of cards) {
      const chain = getAncestors(card).map(el => {
        const cs = getComputedStyle(el);
        const r = el.getBoundingClientRect && el.getBoundingClientRect();
        return {
          tag: el.tagName, cls: (el.className || '').slice(0, 60),
          display: cs.display, flex: cs.flex && cs.flex !== '0 0 auto' ? cs.flex : cs.flex,
          flexDir: cs.flexDirection, pos: cs.position, zIndex: cs.zIndex,
          width: cs.width, height: cs.height, top: cs.top, left: cs.left,
          inset: cs.inset, overflow: cs.overflow, visibility: cs.visibility,
          op: cs.opacity, content: cs.content,
          // check if parent has definite height
          parentHeight: r ? r.height : null,
        };
      });
      out.push({
        card: {
          text: card.textContent.trim().slice(0, 40),
          cls: card.className || '',
          display: getComputedStyle(card).display,
          rect: card.getBoundingClientRect(),
        },
        chain,
      });
    }
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
