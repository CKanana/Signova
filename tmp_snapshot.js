// Comprehensive computed-style snapshot of the layout chain and the two cards.
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
    const sel = (id) => document.getElementById(id);
    const byCls = (cls) => Array.from(document.querySelectorAll('*')).find(el => (el.className || '') === cls);
    const out = {};
    // Key ancestors
    const walkProps = (el, label) => {
      if (!el) return;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      out[label] = {
        tag: el.tagName, cls: (el.className || '').slice(0, 50),
        display: cs.display, flexDirection: cs.flexDirection, flex: cs.flex,
        alignItems: cs.alignItems, justifyContent: cs.justifyContent,
        height: cs.height, width: cs.width, top: cs.top, left: cs.left, inset: cs.inset,
        position: cs.position, zIndex: cs.zIndex, overflow: cs.overflow,
        visibility: cs.visibility, opacity: cs.opacity,
        rect: r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null,
      };
    };
    // find by traversing from root
    function find(el, tag, cls) {
      if (el && el.tagName === tag && (el.className||'') === cls) return el;
      for (const child of el.children) {
        const found = find(child, tag, cls);
        if (found) return found;
      }
      return null;
    }
    walkProps(document.querySelector('.sn-app'), 'sn-app');
    walkProps(document.getElementById('root'), 'root');
    // screenContent, cardsContainer, topBar, heading, footer, container, body, html
    walkProps(find(document.getElementById('root'), 'DIV', 'screenContent'), 'screenContent');
    walkProps(find(document.getElementById('root'), 'DIV', 'cardsContainer'), 'cardsContainer');
    walkProps(find(document.getElementById('root'), 'DIV', 'topBar'), 'topBar');
    walkProps(find(document.getElementById('root'), 'DIV', 'heading'), 'heading');
    walkProps(find(document.getElementById('root'), 'DIV', 'footer'), 'footer');
    walkProps(find(document.getElementById('root'), 'DIV', 'container'), 'container');
    walkProps(document.body, 'body');
    walkProps(document.documentElement, 'html');

    // The two method buttons
    out.cards = Array.from(document.querySelectorAll('button')).filter(b => b.textContent.trim().startsWith('Sign language') || b.textContent.trim().startsWith('Text')).map(b => {
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      return { text: b.textContent.trim().slice(0, 30), cls: b.className || '', display: cs.display, minHeight: cs.minHeight, height: cs.height, width: cs.width, rect: { top: r.top, left: r.left, w: r.width, h: r.height }, parent: b.parentElement ? (b.parentElement.className || '') : '' };
    });
    return out;
  });

  console.log(JSON.stringify(result, null, 2));
  await browser.close();
})();
