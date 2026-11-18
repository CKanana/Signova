import { chromium } from "playwright";

const BASE = "http://localhost:5175";
const OUT = "workspace";

const browser = await chromium.launch({ headless: true });
const errors = [];

async function newPage({ width, height, userAgent }) {
  const context = await browser.newContext({
    viewport: { width, height },
    userAgent,
    isMobile: width < 700,
    hasTouch: width < 700,
  });
  await context.addInitScript(() => {
    const originalAdd = window.addEventListener.bind(window);
    window.addEventListener = function (type, listener, options) {
      if (type === "beforeinstallprompt") return;
      return originalAdd(type, listener, options);
    };
    try {
      localStorage.removeItem("signova-install-dismissed-at");
      localStorage.removeItem("signova-installed");
    } catch {}
  });
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  await page.goto(`${BASE}/welcome`, { waitUntil: "domcontentloaded" });
  return { context, page };
}

{
  const { context, page } = await newPage({ width: 1440, height: 900 });
  await page.waitForSelector(".sn-install", { timeout: 12_000 });
  const pill = await page.evaluate(() => {
    const el = document.querySelector(".sn-install");
    const button = document.querySelector(".sn-install__cta");
    return {
      text: el?.textContent?.replace(/\s+/g, " ").trim(),
      button: button?.textContent?.trim(),
      background: el ? getComputedStyle(el).backgroundColor : null,
      buttonBackground: button ? getComputedStyle(button).backgroundColor : null,
      rect: el?.getBoundingClientRect().toJSON(),
    };
  });
  await page.screenshot({ path: `${OUT}/install-desktop-pill.png`, fullPage: false });

  await page.getByRole("button", { name: "Install", exact: true }).click();
  await page.waitForSelector(".sn-install-modal", { timeout: 5_000 });
  const manual = await page.evaluate(() => ({
    title: document.querySelector(".sn-install-modal__title")?.textContent,
    steps: [...document.querySelectorAll(".sn-install-step")].map((el) =>
      el.textContent?.replace(/\s+/g, " ").trim(),
    ),
    note: document.querySelector(".sn-install-modal__note")?.textContent?.trim(),
  }));
  await page.screenshot({ path: `${OUT}/install-desktop-instructions.png`, fullPage: false });
  await page.getByRole("button", { name: "Got it" }).click();
  console.log(JSON.stringify({ desktop: { pill, manual } }, null, 2));
  await context.close();
}

{
  const { context, page } = await newPage({ width: 1440, height: 900 });
  await page.waitForSelector(".sn-install", { timeout: 12_000 });
  await page.evaluate(() => {
    const event = new Event("beforeinstallprompt");
    Object.defineProperty(event, "prompt", {
      value: async () => {
        window.__signovaPromptCalled = true;
      },
    });
    Object.defineProperty(event, "userChoice", {
      value: Promise.resolve({ outcome: "accepted", platform: "web" }),
    });
    window.__signovaInstallPrompt = event;
    window.dispatchEvent(new Event("signova-install-available"));
  });
  await page.waitForTimeout(250);
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await page.waitForTimeout(600);
  const accepted = await page.evaluate(() => ({
    promptCalled: Boolean(window.__signovaPromptCalled),
    pillGone: !document.querySelector(".sn-install"),
    toast: document.querySelector(".sn-install-toast")?.textContent?.trim(),
  }));
  console.log(JSON.stringify({ accepted }, null, 2));
  await context.close();
}

{
  const androidUA =
    "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36";
  const { context, page } = await newPage({
    width: 390,
    height: 844,
    userAgent: androidUA,
  });
  await page.waitForSelector(".sn-install", { timeout: 12_000 });
  const mobile = await page.evaluate(() => ({
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    text: document.querySelector(".sn-install")?.textContent?.replace(/\s+/g, " ").trim(),
    width: document.querySelector(".sn-install")?.getBoundingClientRect().width,
    viewport: window.innerWidth,
  }));
  await page.screenshot({ path: `${OUT}/install-mobile-pill.png`, fullPage: false });
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await page.waitForSelector(".sn-install-modal", { timeout: 5_000 });
  const android = await page.evaluate(() => ({
    steps: [...document.querySelectorAll(".sn-install-step")].map((el) =>
      el.textContent?.replace(/\s+/g, " ").trim(),
    ),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await page.screenshot({ path: `${OUT}/install-mobile-instructions.png`, fullPage: false });
  console.log(JSON.stringify({ mobile: { mobile, android } }, null, 2));
  await context.close();
}

{
  const iosUA =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
  const { context, page } = await newPage({
    width: 390,
    height: 844,
    userAgent: iosUA,
  });
  await page.waitForSelector(".sn-install", { timeout: 12_000 });
  await page.getByRole("button", { name: "Install", exact: true }).click();
  await page.waitForSelector(".sn-install-modal", { timeout: 5_000 });
  const ios = await page.evaluate(() => ({
    steps: [...document.querySelectorAll(".sn-install-step")].map((el) =>
      el.textContent?.replace(/\s+/g, " ").trim(),
    ),
    note: document.querySelector(".sn-install-modal__note")?.textContent?.trim(),
  }));
  await page.screenshot({ path: `${OUT}/install-ios-instructions.png`, fullPage: false });
  console.log(JSON.stringify({ ios }, null, 2));
  await context.close();
}

await browser.close();
console.log("ERRORS:", errors.length ? JSON.stringify(errors) : "(none)");
