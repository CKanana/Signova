const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push('console.error: ' + msg.text());
  });
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));
  page.on('requestfailed', req => errors.push('requestfailed: ' + req.url() + ' ' + req.failure()?.errorText));

  await page.goto('http://localhost:5177/', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForTimeout(6000);

  // Report whether the app mounted
  const mountInfo = await page.evaluate(() => {
    const root = document.getElementById('root');
    const h1 = document.querySelector('h1');
    const h2 = document.querySelector('h2');
    const buttons = document.querySelectorAll('button');
    const headings = [...document.querySelectorAll('h1, h2')].map(h => h.textContent.trim());
    return {
      rootInnerHTMLLen: root ? root.innerHTML.length : 0,
      h1s: headings.slice(0, 10),
      buttonCount: buttons.length,
      bodyHTML: root ? root.innerHTML : 'NO ROOT',
    };
  });

  console.log('=== MOUNT INFO ===');
  console.log(JSON.stringify(mountInfo, null, 2));

  // Find elements that match card content
  const cardInfo = await page.evaluate(() => {
    const out = [];
    document.querySelectorAll('*').forEach((el, idx) => {
      const t = (el.textContent || '').trim();
      if (/sign language|text/i.test(t)) {
        out.push({
          idx,
          tag: el.tagName,
          cls: typeof el.className === 'string' ? el.className : (el.getAttribute('class') || ''),
          id: el.id,
          text: t.slice(0, 60),
          rect: el.getBoundingClientRect ? el.getBoundingClientRect() : null,
          children: el.children.length,
        });
      }
    });
    return out.slice(0, 30);
  });

  console.log('=== CARD-LIKE ELEMENTS ===');
  console.log(JSON.stringify(cardInfo, null, 2));

  // Computed styles for the two buttons (closest <button> to card text)
  const computed = await page.evaluate(() => {
    const res = [];
    document.querySelectorAll('button').forEach((btn, idx) => {
      const txt = (btn.textContent || '').trim();
      // Only buttons that look like a method card button (contain sign/text or are inside cards)
      const cls = btn.className || '';
      if (cls.includes('methodCard') || cls.includes('card') || txt === 'Sign language' || txt === 'Text') {
        const cs = getComputedStyle(btn);
        res.push({
          idx,
          text: txt.slice(0, 40),
          cls,
          display: cs.display,
          visibility: cs.visibility,
          opacity: cs.opacity,
          position: cs.position,
          zIndex: cs.zIndex,
          overflow: cs.overflow,
          width: cs.width,
          height: cs.height,
          boxShadow: cs.boxShadow,
        });
      }
    });
    return res;
  });

  console.log('=== BUTTON COMPUTED STYLES ===');
  console.log(JSON.stringify(computed, null, 2));

  console.log('=== CONSOLE ERRORS ===');
  console.log(errors.length ? errors.join('\n') : '(none)');

  await browser.close();
})();
