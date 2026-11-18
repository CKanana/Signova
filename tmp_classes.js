// Dump all class names in the DOM near the "Choose how you'd like to" heading, and styles for screenContent/cardsContainer/topBar/heading/footer/container.
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
    // all elements with classes containing any of our key strings
    const keys = ['screenContent','cardsContainer','topBar','heading','footer','container','methodCard','cardContent','cardCopy','cardAction','cardTitle','iconBubble','brandAndOrganisation','organisationLockup','eyebrow','title','subtitle','caption'];
    const out = { elements: [], classes: [] };
    document.querySelectorAll('*').forEach(el => {
      const cls = el.className || '';
      if (cls) {
        const matched = keys.some(k => cls.includes(k));
        if (matched) {
          const cs = getComputedStyle(el);
          out.elements.push({
            tag: el.tagName, cls: cls.slice(0, 120),
            display: cs.display, flexDir: cs.flexDirection, height: cs.height, width: cs.width,
            top: cs.top, left: cs.left, zIndex: cs.zIndex, position: cs.position,
            opacity: cs.opacity, visibility: cs.visibility, overflow: cs.overflow,
          });
        }
        // unique classes list (first 200)
        cls.split(/\s+/).forEach(c => {
          if (c && !out.classes.includes(c)) out.classes.push(c);
        });
      }
    });
    return out;
  });

  console.log('=== UNIQUE CLASSES (first 200) ===');
  console.log(result.classes.slice(0, 200).join('\n'));
  console.log('\n=== ELEMENTS MATCHING KEY CLASSES ===');
  console.log(JSON.stringify(result.elements, null, 2));
  await browser.close();
})();
