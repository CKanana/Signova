// Precise dump: find MethodSelectScreen elements in DOM by their position and dump inline style + rect.
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
    const info = (el, label) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        label,
        tag: el.tagName,
        style: el.getAttribute('style') || '',
        display: cs.display,
        flex: cs.flex,
        flexDir: cs.flexDirection,
        alignItems: cs.alignItems,
        justifyContent: cs.justifyContent,
        width: cs.width,
        height: cs.height,
        minHeight: cs.minHeight,
        padding: cs.padding,
        gap: cs.gap,
        position: cs.position,
        zIndex: cs.zIndex,
        overflow: cs.overflow,
        visibility: cs.visibility,
        opacity: cs.opacity,
        rect: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
      };
    };
    // Walk from root to find the screenContent, then its children in order
    const root = document.getElementById('root');
    const out = { root: info(root, 'root') };
    // Find screenContent
    for (const child of root.children) {
      const cs = getComputedStyle(child);
      if ((child.className || '') === 'screenContent' || (child.getAttribute('style') || '').includes('zIndex: 3')) {
        out.screenContent = info(child, 'screenContent');
        // its first few children
        const kids = [];
        for (const ch of child.children) {
          kids.push(info(ch, 'child:' + ch.tagName + ':' + (ch.className || '')));
        }
        out.screenContent.children = kids.slice(0, 8);
      }
    }
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
