// Playwright script: navigate to the method-selection (MethodSelectScreen) step
// and dump full DOM/CSS/visibility/computed styles of the two method cards.
const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
  });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));
  page.on('requestfailed', req => errors.push('requestfailed: ' + req.url() + ' ' + req.failure()?.errorText));

  await page.goto('http://localhost:5175/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(2500); // let splash run

  // Click "Start communication" to enter MethodSelectScreen
  const btn = page.locator('button:has-text("Start communication")');
  try {
    await btn.first().click();
  } catch (e) {
    console.log('click err', e.message);
  }
  await page.waitForTimeout(2500);

  // Now inspect
  const result = await page.evaluate(() => {
    function walk(node, depth) {
      depth = depth || 0;
      var out = '';
      var tag = (node.nodeType === Node.ELEMENT_NODE) ? node.tagName.toLowerCase() : '#text';
      var cls = node.className ? ' class="' + node.className + '"' : '';
      var id = node.id ? ' id="' + node.id + '"' : '';
      out += Array(depth + 1).join('  ') + tag + cls + id + ' child=' + (node.childNodes ? node.childNodes.length : 0) + '\\n';
      for (var i = 0; i < node.childNodes.length; i++) out += walk(node.childNodes[i], depth + 1);
      return out;
    }
    const root = document.getElementById('root');
    const h1s = Array.from(document.querySelectorAll('h1')).map(h => h.textContent.trim());
    const h2s = Array.from(document.querySelectorAll('h2')).map(h => h.textContent.trim());
    const bodyHTML = root ? root.innerHTML : 'NO ROOT';
    // Find the cards container (contains 'Sign language' and 'Text')
    const cards = [];
    document.querySelectorAll('*').forEach((el, idx) => {
      const t = (el.textContent || '').trim();
      if (/Sign language|Text language|Choose how/i.test(t)) {
        const cs = getComputedStyle(el);
        cards.push({
          idx, tag: el.tagName, cls: (el.className || '').slice(0, 80), id: el.id,
          text: t.slice(0, 50),
          display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
          position: cs.position, zIndex: cs.zIndex, overflow: cs.overflow,
          width: cs.width, height: cs.height,
          rect: el.getBoundingClientRect ? el.getBoundingClientRect() : null,
        });
      }
    });
    // All buttons with styles
    const buttons = Array.from(document.querySelectorAll('button')).map(b => {
      const cs = getComputedStyle(b);
      return { text: b.textContent.trim().slice(0, 40), cls: b.className || '', display: cs.display, vis: cs.visibility, op: cs.opacity, pos: cs.position, z: cs.zIndex, width: cs.width, height: cs.height, rect: b.getBoundingClientRect ? b.getBoundingClientRect() : null };
    });
    return { rootInnerHTMLLen: root ? root.innerHTML.length : 0, h1s, h2s, bodyHTMLLen: bodyHTML.length, cards: cards.slice(0, 20), buttons: buttons.slice(0, 15) };
  });

  console.log('=== HEADINGS ===');
  console.log(JSON.stringify(result.h1s, null, 2));
  console.log('=== BUTTONS ===');
  console.log(JSON.stringify(result.buttons, null, 2));
  console.log('=== CARD-LIKE ELEMENTS ===');
  console.log(JSON.stringify(result.cards, null, 2));

  console.log('=== CONSOLE ERRORS ===');
  console.log(errors.length ? errors.join('\n') : '(none)');

  await browser.close();
})();
