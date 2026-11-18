import { chromium } from "playwright";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1080, height: 1920 } });
await page.route("**/api/**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ organization: null, tellers: [], session: null, messages: [] }) }));
await page.goto("http://localhost:4173/welcome", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);
await page.evaluate(() => {
  history.pushState({ step: "live" }, "", "/live");
  window.dispatchEvent(new PopStateEvent("popstate", { state: { step: "live" } }));
});
await page.waitForTimeout(2500);
const info = await page.evaluate(() => {
  const body = document.querySelector(".sn-live-body");
  const convo = document.querySelector(".sn-convo");
  const stage = document.querySelector(".sn-camera__stage");
  const actions = document.querySelector(".sn-live-header__actions");
  return {
    path: location.pathname,
    viewport: [innerWidth, innerHeight],
    hasLive: Boolean(document.querySelector(".sn-live")),
    bodyDisplay: body ? getComputedStyle(body).display : null,
    bodyDirection: body ? getComputedStyle(body).flexDirection : null,
    convoPosition: convo ? getComputedStyle(convo).position : null,
    stageAspect: stage ? getComputedStyle(stage).aspectRatio : null,
    headerActions: actions ? getComputedStyle(actions).display : null,
  };
});
console.log(JSON.stringify(info, null, 2));
await page.screenshot({ path: "workspace/portrait-live.png", fullPage: false });
await browser.close();
