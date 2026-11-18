// Measure inline style + computed lineHeight for title, subtitle, cardTitle, methodCard, cardsContainer, topBar, heading.
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
    const out = {};
    const sel = (s) => document.querySelector(s);
    const measure = (el, label) => {
      if (!el) return;
      const cs = getComputedStyle(el);
      out[label] = {
        inline: el.getAttribute('style') || '',
        display: cs.display,
        fontFamily: cs.fontFamily,
        fontSize: cs.fontSize,
        lineHeight: cs.lineHeight,
        height: cs.height,
        width: cs.width,
        rect: el.getBoundingClientRect() ? { top: el.getBoundingClientRect().top, w: el.getBoundingClientRect().width, h: el.getBoundingClientRect().height } : null,
      };
    };
    measure(sel('.title'), 'title');
    measure(sel('.subtitle'), 'subtitle');
    measure(sel('.cardTitle'), 'cardTitle');
    measure(sel('.methodCard'), 'methodCard');
    measure(sel('.cardsContainer'), 'cardsContainer');
    measure(sel('.cardsContainer').parentElement, 'cardsContainerParent');
    measure(sel('.topBar'), 'topBar');
    measure(sel('.heading'), 'heading');
    measure(sel('.screenContent'), 'screenContent');
    // All divs whose rect top > 100 and their heights (to find the layout chain)
    out.layoutChain = Array.from(document.querySelectorAll('#root div')).filter(d => d.getBoundingClientRect && d.getBoundingClientRect().top > 100 && (d.getBoundingClientRect().height || 0) > 0).map(d => {
      const cs2 = getComputedStyle(d);
      return { tag: d.tagName, cls: d.className || '', top: d.getBoundingClientRect().top, height: cs2.height, display: cs2.display, flex: cs2.flex, minh: cs2.minHeight, width: cs2.width };
    });
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
