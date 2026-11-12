const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto("http://localhost:5174/admin/overview", { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  const info = await page.evaluate(() => {
    const root = document.documentElement;
    return {
      dataTheme: root.getAttribute("data-theme"),
      classList: root.className,
      bodyBg: document.body.style.backgroundColor,
      appShellClass: document.querySelector(".app-shell") ? "yes" : "no",
      appShellStyle: document.querySelector(".app-shell")
        ? getComputedStyle(document.querySelector(".app-shell")).cssText.substring(0, 200)
        : "no",
      sidebarExists: !!document.querySelector(".app-sidebar"),
      topbarExists: !!document.querySelector(".app-topbar"),
      mainExists: !!document.querySelector(".app-main"),
      mainClass: document.querySelector(".app-main")
        ? getComputedStyle(document.querySelector(".app-main")).className
        : "no",
      rootHtml: document.documentElement.className,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
