// Report computed fontSize, lineHeight (with unit check), and actual rendered height of the h1 and card buttons.
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
    const el = (s) => document.querySelector(s);
    const info = (el, label) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return { label, tag: el.tagName, cls: (el.className||'').slice(0,40),
        inline: el.getAttribute('style') || '',
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        height: cs.height,
        width: cs.width,
        rect: r ? { top: r.top, left: r.left, w: r.width, h: r.height } : null,
        computedLineHeightNum: cs.lineHeight === 'normal' ? 'normal' : (typeof cs.lineHeight === 'number' ? cs.lineHeight : parseFloat(cs.lineHeight)) };
    };
    return {
      title: info(el('.title'), 'title'),
      subtitle: info(el('.subtitle'), 'subtitle'),
      cardTitle: info(el('.cardTitle'), 'cardTitle'),
      cardsContainer: info(el('.cardsContainer'), 'cardsContainer'),
      methodCard1: info(el('button').firstElementChild, 'methodCard1'),
      methodCard1rect: el('button').firstElementChild ? el('button').firstElementChild.getBoundingClientRect() : null,
      // computed line boxes
      h1ClientRects: el('.title') ? el('.title').getClientRects().length : 0,
      h1ScrollHeight: el('.title') ? el('.title').scrollHeight : 0,
      h1OffsetHeight: el('.title') ? el('.title').offsetHeight : 0,
      h1LineHeightStr: el('.title') ? getComputedStyle(el('.title')).lineHeight : 'n/a',
      h1FontStr: el('.title') ? getComputedStyle(el('.title')).fontSize : 'n/a',
    };
  });
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
