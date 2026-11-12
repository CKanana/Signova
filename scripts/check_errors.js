const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  page.on("console", (msg) => console.log("[console]", msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log("[pageerror]", err.message));
  page.on("requestfailed", (req) => console.log("[requestfailed]", req.url(), req.failure()?.errorText));
  await page.goto("http://localhost:5174/admin/overview", { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);

  const info = await page.evaluate(() => {
    const root = document.documentElement;
    const app = document.getElementById("root");
    return {
      dataTheme: root.getAttribute("data-theme"),
      htmlClass: root.className,
      rootInnerHTML: app ? app.innerHTML.substring(0, 300) : "no root",
      bodyHTML: document.body.innerHTML.substring(0, 400),
      hasAppShell: !!document.querySelector(".app-shell"),
      allStyles: document.querySelectorAll("style").length,
      allLinks: document.querySelectorAll("link").length,
      scripts: document.querySelectorAll("script").length,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  await browser.close();
})();
