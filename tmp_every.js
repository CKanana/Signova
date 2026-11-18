// Dump every element under #root with its inline style, rect, and computed display/height.
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
    const out = [];
    function walk(node, depth) {
      depth = depth || 0;
      const cs = node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node) : null;
      const r = node.nodeType === Node.ELEMENT_NODE ? node.getBoundingClientRect() : null;
      out.push({
        depth,
        tag: node.nodeType === Node.ELEMENT_NODE ? node.tagName : '#text',
        cls: node.nodeType === Node.ELEMENT_NODE ? (node.className || '') : '',
        inline: node.nodeType === Node.ELEMENT_NODE ? (node.getAttribute('style') || '') : '',
        display: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).display : '',
        flex: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).flex : '',
        flexDir: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).flexDirection : '',
        alignItems: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).alignItems : '',
        justify: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).justifyContent : '',
        width: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).width : '',
        height: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).height : '',
        minHeight: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).minHeight : '',
        top: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).top : '',
        left: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).left : '',
        zIndex: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).zIndex : '',
        pos: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).position : '',
        overflow: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).overflow : '',
        visibility: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).visibility : '',
        opacity: node.nodeType === Node.ELEMENT_NODE ? getComputedStyle(node).opacity : '',
        rect: node.nodeType === Node.ELEMENT_NODE ? (() => { const r = node.getBoundingClientRect(); return r ? { top: r.top, left: r.left, width: r.width, height: r.height } : null; })() : null,
      });
      for (let i = 0; i < node.childNodes.length; i++) walk(node.childNodes[i], depth + 1);
    }
    walk(document.getElementById('root'));
    return out;
  });

  // Print compactly
  for (const e of result) {
    console.log(`${e.depth} ${e.tag}.${e.cls} | style="${e.inline.slice(0,80)}" | display=${e.display} flex=${e.flex} dir=${e.flexDir} ai=${e.alignItems} jc=${e.justify} w=${e.width} h=${e.height} minh=${e.minHeight} top=${e.top} left=${e.left} z=${e.zIndex} pos=${e.pos} ov=${e.overflow} vis=${e.visibility} op=${e.opacity} rect=(${e.rect?e.rect.top:'?'},${e.rect?e.rect.left:'?'},w=${e.rect?e.rect.width:'?'},h=${e.rect?e.rect.height:'?'})`);
  }
  await browser.close();
})();
