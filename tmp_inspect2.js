const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();

  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push('console.error: ' + msg.text()); });
  page.on('pageerror', err => errors.push('pageerror: ' + err.message));
  page.on('requestfailed', req => errors.push('requestfailed: ' + req.url() + ' ' + req.failure()?.errorText));

  // Load the HTML directly to see what dev server served
  const response = await page.goto('http://localhost:5177/', { waitUntil: 'domcontentloaded', timeout: 30000 });
  console.log('STATUS:', response ? response.status() : 'none');
  const html = await page.content();
  console.log('=== FULL HTML (truncated) ===');
  console.log(html.slice(0, 3000));

  await page.waitForTimeout(4000);

  const info = await page.evaluate(() => {
    return {
      rootInnerHTMLLen: document.getElementById('root') ? document.getElementById('root').innerHTML.length : 0,
      h1s: [...document.querySelectorAll('h1')].map(h => h.textContent.trim()),
      bodyHTMLLen: document.body.innerHTML.length,
    };
  });
  console.log('=== MOUNT INFO ===');
  console.log(JSON.stringify(info, null, 2));

  console.log('=== ERRORS ===');
  console.log(errors.length ? errors.join('\n') : '(none)');

  // Network requests
  const requests = await page.evaluate(() => {
    return [...document.querySelectorAll('script')].map(s => s.src || s.getAttribute('src')).filter(Boolean);
  });
  console.log('=== SCRIPTS ===');
  console.log(requests.join('\n'));

  await browser.close();
})();
