const { chromium } = require("playwright");

async function capture(label, url, theme, collapsed) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  // Toggle theme if needed
  if (theme === "dark") {
    try {
      await page.click("button[aria-label*='dark mode']");
      await page.waitForTimeout(300);
    } catch {}
  }

  // Toggle collapse if needed (click the collapse button in sidebar)
  if (collapsed) {
    try {
      await page.click("button[aria-label*='Collapse']");
      await page.waitForTimeout(300);
    } catch {}
  }

  const path = `screenshots/${label}.png`;
  await page.screenshot({ path, fullPage: true });
  console.log(`Saved ${path}`);

  // Gather data for reporting
  const sidebarW = await page.evaluate(() => {
    const el = document.querySelector(".app-sidebar");
    return el ? getComputedStyle(el).width : "n/a";
  });
  const topbarBg = await page.evaluate(() => {
    const el = document.querySelector(".app-topbar");
    return el ? getComputedStyle(el).backgroundColor : "n/a";
  });
  const sidebarBg = await page.evaluate(() => {
    const el = document.querySelector(".app-sidebar");
    return el ? getComputedStyle(el).backgroundImage : "n/a";
  });
  const contentStart = await page.evaluate(() => {
    const el = document.querySelector(".app-main__content");
    if (!el) return "n/a";
    const rect = el.getBoundingClientRect();
    return { left: Math.round(rect.left), top: Math.round(rect.top), width: Math.round(rect.width) };
  });
  const activeNav = await page.evaluate(() => {
    const el = document.querySelector(".app-sidebar__nav-item--active");
    return el ? el.textContent.trim() : "none";
  });
  const breadcrumb = await page.evaluate(() => {
    const el = document.querySelector(".app-topbar__subtitle");
    return el ? el.textContent.trim() : "n/a";
  });
  const mainW = await page.evaluate(() => {
    const el = document.querySelector(".app-main");
    return el ? getComputedStyle(el).width : "n/a";
  });

  await browser.close();

  return { label, sidebarW, topbarBg, sidebarBg, contentStart, activeNav, breadcrumb, mainW };
}

(async () => {
  const base = "http://localhost:5174";
  const results = [];

  // Admin Overview: light, expanded and collapsed
  results.push(await capture("admin_overview_light", base + "/admin/overview", "light", false));
  results.push(await capture("admin_overview_dark", base + "/admin/overview", "dark", false));
  results.push(await capture("admin_overview_collapsed", base + "/admin/overview", "light", true));

  // Admin Staff Directory
  results.push(await capture("admin_staff_light", base + "/admin/staff", "light", false));
  results.push(await capture("admin_staff_dark", base + "/admin/staff", "dark", false));
  results.push(await capture("admin_staff_collapsed", base + "/admin/staff", "light", true));

  // Save results as JSON for reporting
  const fs = require("fs");
  fs.writeFileSync("screenshots/results.json", JSON.stringify(results, null, 2));
  console.log("\nDONE");
})();
