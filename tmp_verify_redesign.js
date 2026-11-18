// Verify the redesigned method-selection screen at desktop (1280), tablet (768), and mobile (375).
const { chromium } = require('playwright');
const sizes = [
  { name: 'desktop', width: 1280, height: 900 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'mobile', width: 375, height: 812 },
];

const results = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  for (const sz of sizes) {
    const ctx = await browser.newContext({ viewport: { width: sz.width, height: sz.height }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    const errs = [];
    page.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
    page.on('pageerror', e => errs.push(e.message));
    page.on('requestfailed', r => errs.push(r.url() + ' ' + (r.failure()?.errorText || '')));

    await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(2500);
    await page.locator('button:has-text("Start communication")').first().click();
    await page.waitForTimeout(2500);

    const res = await page.evaluate(({ width, height }) => {
      const el = (s) => document.querySelector(s);
      const info = (e, label) => {
        if (!e) return null;
        const cs = getComputedStyle(e);
        const r = e.getBoundingClientRect();
        return { label, tag: e.tagName, inline: e.getAttribute('style') || '',
          display: cs.display, width: cs.width, height: cs.height, lineHeight: cs.lineHeight,
          color: cs.color, bg: cs.backgroundColor, borderRadius: cs.borderRadius,
          shadow: cs.boxShadow, border: cs.borderColor, opacity: cs.opacity, vis: cs.visibility,
          top: r ? r.top : null, left: r ? r.left : null, w: r ? r.width : null, h: r ? r.height : null };
      };
      const cards = [];
      const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.trim().includes('Continue with'));
      for (const b of btns) {
        const r = b.getBoundingClientRect();
        cards.push({ text: b.textContent.trim().split('\n')[0].slice(0, 30), rect: { top: r.top, left: r.left, w: r.width, h: r.height }, display: getComputedStyle(b).display });
      }
      const h1 = el('.title') ? info(el('.title'), 'title') : null;
      const subtitle = el('.subtitle') ? info(el('.subtitle'), 'subtitle') : null;
      const logo = el('img[src*="logo"]') ? { src: el('img[src*="logo"]').getAttribute('src'), w: el('img[src*="logo"]').getBoundingClientRect().width, h: el('img[src*="logo"]').getBoundingClientRect().height } : null;
      return {
        viewport: { width, height },
        h1, subtitle, cards, logo, consoleErrors: errs,
        totalButtons: document.querySelectorAll('button').length,
      };
    }, sz);

    results.push({ size: sz.name, ...res });
    await page.close();
  }
  await browser.close();
})();

setTimeout(() => {
  const out = JSON.stringify(results, null, 2);
  require('fs').writeFileSync('/tmp/method_screen_results.json', out);
  console.log(out);
}, 500);
