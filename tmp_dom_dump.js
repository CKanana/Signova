// Dump the complete DOM + computed styles of the method-selection screen in full.
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
    function walk(node, depth) {
      depth = depth || 0;
      var out = '';
      var tag = (node.nodeType === Node.ELEMENT_NODE) ? node.tagName.toLowerCase() : '#text';
      var cls = node.className ? ' class="' + node.className + '"' : '';
      var id = node.id ? ' id="' + node.id + '"' : '';
      var txt = (node.textContent || '').trim().slice(0, 40);
      out += Array(depth + 1).join('  ') + tag + cls + id + ' | ' + txt + '\\n';
      for (var i = 0; i < node.childNodes.length; i++) out += walk(node.childNodes[i], depth + 1);
      return out;
    }
    return walk(document.getElementById('root'));
  });
  require('fs').writeFileSync('/tmp/method_dom.txt', result);
  console.log('WROTE DOM len ' + result.length);
  await browser.close();
})();
