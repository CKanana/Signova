const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto("http://localhost:5174/admin/overview", { waitUntil: "networkidle" });
  await page.waitForTimeout(800);

  const data = await page.evaluate(() => {
    const sel = (s) => {
      const el = document.querySelector(s);
      return el ? getComputedStyle(el) : null;
    };
    const rect = (s) => {
      const el = document.querySelector(s);
      return el ? el.getBoundingClientRect() : null;
    };

    // Sidebar
    const sidebar = document.querySelector(".app-sidebar");
    const sidebarW = sidebar ? sidebar.getBoundingClientRect().width : "n/a";
    const sidebarBg = sidebar ? sel(".app-sidebar").backgroundImage : "n/a";
    const sidebarColor = sidebar ? sel(".app-sidebar").color : "n/a";
    const logoColor = sidebar ? sel(".app-sidebar__logo-mark").color : "n/a";

    // Topbar
    const topbar = document.querySelector(".app-topbar");
    const topbarW = topbar ? topbar.getBoundingClientRect().width : "n/a";
    const topbarBg = topbar ? sel(".app-topbar").backgroundColor : "n/a";
    const topbarColor = topbar ? sel(".app-topbar").color : "n/a";

    // Main content
    const main = document.querySelector(".app-main");
    const mainW = main ? main.getBoundingClientRect().width : "n/a";
    const mainLeft = main ? Math.round(main.getBoundingClientRect().left) : "n/a";
    const content = document.querySelector(".app-main__content");
    const contentR = content ? content.getBoundingClientRect() : null;
    const contentStart = contentR ? { left: Math.round(contentR.left), top: Math.round(contentR.top), width: Math.round(contentR.width) } : "n/a";

    // Active nav item
    const activeNav = document.querySelector(".app-sidebar__nav-item--active");
    const activeNavText = activeNav ? activeNav.textContent.trim() : "none";
    const activeNavBg = activeNav ? sel(".app-sidebar__nav-item--active").backgroundColor : "n/a";

    // Breadcrumb
    const subtitle = document.querySelector(".app-topbar__subtitle");
    const breadcrumb = subtitle ? subtitle.textContent.trim() : "n/a";
    const breadcrumbColor = subtitle ? sel(".app-topbar__subtitle").color : "n/a";

    // Viewport
    const viewportW = window.innerWidth;

    // Horizontal positions (no overflow)
    const bodyScrollW = document.body.scrollWidth;
    const htmlScrollW = document.documentElement.scrollWidth;

    // Sidebar collapse toggle button
    const collapseBtn = document.querySelector(".app-sidebar__toggle");
    const collapseAria = collapseBtn ? collapseBtn.getAttribute("aria-expanded") : "n/a";

    // Theme
    const theme = document.documentElement.getAttribute("data-theme");

    return {
      sidebarW,
      sidebarBg,
      sidebarColor,
      logoColor,
      topbarW,
      topbarBg,
      topbarColor,
      mainW,
      mainLeft,
      contentStart,
      activeNavText,
      activeNavBg,
      breadcrumb,
      breadcrumbColor,
      viewportW,
      bodyScrollW,
      htmlScrollW,
      collapseAria,
      theme,
    };
  });

  console.log(JSON.stringify(data, null, 2));
  await browser.close();
})();
