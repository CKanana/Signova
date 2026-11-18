// Dump rects + computed styles for every key screen element, and the full ancestor chain of each card.
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
    function cs(el) { return getComputedStyle(el); }
    const rect = (el) => { const r = el.getBoundingClientRect(); return r ? {top:r.top, left:r.left, width:r.width, height:r.height} : null; };
    // Find elements by class (the style object keys)
    function byClass(cls) { return Array.from(document.querySelectorAll('*')).find(el => (el.className||'') === cls); }
    const keys = ['container','bgWrap','bgWash','screenContent','topBar','heading','cardsContainer','footer','methodCard','methodCardTablet','signCard','textCard','cardContent','cardContentCompactTablet','cardTitle','iconBubble','cardCopy','cardCopyCompactTablet','cardAction','cardActionCompactTablet','title','titleCompactTablet','cardsContainerTablet','cardsContainerCompactTablet','topBarCompactTablet','topBarCompactPhone','headerButton','footerCompactTablet'];
    const out = {};
    for (const k of keys) {
      const el = byClass(k);
      out[k] = el ? { tag: el.tagName, cls: (el.className||''), rect: rect(el), display: cs(el).display, flexDir: cs(el).flexDirection, height: cs(el).height, width: cs(el).width, top: cs(el).top, left: cs(el).left, zIndex: cs(el).zIndex, pos: cs(el).position, overflow: cs(el).overflow, visibility: cs(el).visibility, opacity: cs(el).opacity, minHeight: cs(el).minHeight, flex: cs(el).flex, gap: cs(el).gap, padding: cs(el).padding, justify: cs(el).justifyContent } : null;
    }
    // Two cards
    out.cards = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim().startsWith('Sign language') || b.textContent.trim().startsWith('Text')).map(b => { const cs2 = cs(b); const r = rect(b); return { text: b.textContent.trim().slice(0,30), cls: b.className||'', rect: r, display: cs2.display, minHeight: cs2.minHeight, height: cs2.height, width: cs2.width, parentClass: b.parentElement ? (b.parentElement.className||'') : '' }; });
    // Full ancestor chain of each card (tag, cls, display, height, width, top, zIndex, flex, position)
    out.cardChains = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim().startsWith('Sign language') || b.textContent.trim().startsWith('Text')).map(b => {
      const chain = [];
      let el = b.parentElement;
      while (el) { const c = cs(el); chain.push({ tag: el.tagName, cls: (el.className||'').slice(0,40), display: c.display, height: c.height, width: c.width, top: c.top, left: c.left, zIndex: c.zIndex, flex: c.flex, pos: c.position, overflow: c.overflow, rect: rect(el) }); el = el.parentElement; }
      return chain;
    });
    return out;
  });

  console.log('=== KEY ELEMENTS ===');
  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
