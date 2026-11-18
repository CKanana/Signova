import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:5175";
const OUT = "workspace";
const POSE = JSON.parse(
  readFileSync(`${OUT}/pwa-pose.json`, "utf8").replace(/^\uFEFF/, ""),
);
const VIDEO = readFileSync(`${OUT}/sample-transcode.mp4`);

const org = {
  _id: "org-test",
  name: "Kenyatta National Hospital",
  shortName: "KNH",
  welcomeMessage: "Welcome",
  serviceName: "Patient services",
  counterLabel: "Counter",
  colors: { primary: "#602B91", background: "#FFF9E5" },
  isActive: true,
};
const teller = {
  _id: "teller-1",
  name: "Grace Wanjiku",
  serviceLabel: "Patient services",
  serviceDesk: "Ground floor",
  counterNumber: "1",
  status: "BUSY",
  pairingCode: "123456",
};
const sessionId = "session-avatar-pwa";
const session = {
  _id: sessionId,
  organization: org._id,
  teller: teller._id,
  deafUser: "deaf-test",
  method: "sign",
  status: "ACTIVE",
  pairingCode: "123456",
  messageCount: 2,
  startedAt: new Date(Date.now() - 20_000).toISOString(),
};
const animationUrl = `/api/sessions/${sessionId}/messages/msg-staff/animation`;
const staffMessage = {
  _id: "msg-staff",
  sessionId,
  sender: "STAFF",
  text: "How can I help you today?",
  method: "speech",
  isConfirmed: true,
  timestamp: new Date(Date.now() - 10_000).toISOString(),
  animationUrl,
  generationStatus: "completed",
  animation: {
    status: "ready",
    url: animationUrl,
    durationMs: 2200,
    requestedAt: new Date(Date.now() - 12_000).toISOString(),
    readyAt: new Date(Date.now() - 9_000).toISOString(),
    error: null,
  },
};
const messages = [
  staffMessage,
  {
    _id: "msg-user",
    sessionId,
    sender: "USER",
    text: "help",
    method: "sign",
    isConfirmed: true,
    timestamp: new Date(Date.now() - 5_000).toISOString(),
    animationUrl: null,
    generationStatus: "completed",
    animation: null,
  },
];

async function installRoutes(page, { poseFails = false } = {}) {
  await page.route("**/api/kiosk/organization", (route) =>
    route.fulfill({ json: { organization: org } }),
  );
  await page.route("**/api/kiosk/tellers", (route) =>
    route.fulfill({ json: { organizationId: org._id, tellers: [teller] } }),
  );
  await page.route("**/api/sessions/current", (route) =>
    route.fulfill({ json: { session } }),
  );
  await page.route(`**/api/sessions/${sessionId}/messages`, (route) =>
    route.fulfill({ json: { messages } }),
  );
  await page.route(
    `**/api/sessions/${sessionId}/messages/*/pose`,
    (route) => {
      if (poseFails) {
        return route.fulfill({ status: 500, json: { error: "pose failed" } });
      }
      return route.fulfill({ json: { pose: POSE } });
    },
  );
  await page.route(
    `**/api/sessions/${sessionId}/messages/*/animation`,
    (route) => {
      if (route.request().method() === "OPTIONS") {
        return route.fulfill({
          status: 204,
          headers: {
            "access-control-allow-origin": BASE,
            "access-control-allow-methods": "GET,OPTIONS",
            "access-control-allow-headers": "authorization,content-type",
          },
        });
      }
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "video/mp4",
          "content-length": String(VIDEO.length),
          "access-control-allow-origin": BASE,
          "access-control-allow-headers": "authorization",
        },
        body: VIDEO,
      });
    },
  );
  await page.route("**/socket.io/**", (route) => route.abort());
}

async function bootstrap(context) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("signova.accessToken", "test-token");
      localStorage.setItem("signova-installed", "1");
    } catch {}
  });
}

async function avatarMetrics(page, selector = ".sn-avatar-card") {
  return page.evaluate((sel) => {
    const card = document.querySelector(sel);
    if (!card) return null;
    const svg = card.querySelector("svg");
    const progress = card.querySelector(".sn-avatar-progress > span");
    return {
      card: Boolean(card),
      svg: Boolean(svg),
      paths: card.querySelectorAll("svg path").length,
      circles: card.querySelectorAll("svg circle").length,
      gloss: card.querySelector(".sn-avatar-card__gloss")?.textContent?.trim(),
      status: card.querySelector(".sn-avatar-card__status")?.textContent?.trim(),
      caption: card.querySelector(".sn-avatar-caption__text")?.textContent?.trim(),
      controls: [...card.querySelectorAll(".sn-avatar-controls button")].map((el) =>
        el.textContent?.trim(),
      ),
      progressWidth: progress ? getComputedStyle(progress).width : null,
      firstPath: svg?.querySelector("path")?.getAttribute("d")?.slice(0, 80),
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  }, selector);
}

const browser = await chromium.launch({ headless: true });
const errors = [];

async function makePage(width, height, routesOptions, path = "/live") {
  const context = await browser.newContext({ viewport: { width, height } });
  await bootstrap(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console: ${message.text()}`);
  });
  await installRoutes(page, routesOptions);
  await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".sn-live-shell, .sn-avatar-card", { timeout: 30_000 });
  return { context, page };
}

{
  const { context, page } = await makePage(1440, 900);
  await page.waitForSelector(".sn-avatar-card", { timeout: 20_000 });
  await page.waitForSelector(".sn-avatar-stage svg", { timeout: 20_000 });
  const first = await avatarMetrics(page);
  await page.waitForTimeout(800);
  const second = await avatarMetrics(page);
  await page.screenshot({ path: `${OUT}/pwa-avatar-conversation.png`, fullPage: true });
  await page.getByRole("button", { name: "Replay" }).first().click();
  await page.waitForTimeout(250);
  const replayed = await avatarMetrics(page);
  console.log(
    JSON.stringify(
      {
        conversation: {
          first,
          second,
          replayed,
          animated:
            first?.progressWidth !== second?.progressWidth ||
            first?.firstPath !== second?.firstPath,
        },
      },
      null,
      2,
    ),
  );
  await context.close();
}

{
  const { context, page } = await makePage(390, 844);
  await page.getByRole("button", { name: "Open conversation" }).click();
  await page.waitForSelector(".sn-avatar-card", { state: "visible", timeout: 20_000 });
  await page.waitForSelector(".sn-avatar-stage svg", { state: "visible", timeout: 20_000 });
  const mobile = await avatarMetrics(page);
  await page.screenshot({ path: `${OUT}/pwa-avatar-mobile.png`, fullPage: true });
  console.log(JSON.stringify({ mobile }, null, 2));
  await context.close();
}

{
  const { context, page } = await makePage(1440, 900, { poseFails: true });
  await page.waitForSelector(".sn-avatar-error", { timeout: 20_000 });
  await page.waitForSelector(".sn-avatar-videoFallback", { timeout: 10_000 });
  const fallback = await page.evaluate(() => ({
    error: document.querySelector(".sn-avatar-error__title")?.textContent,
    label: document.querySelector(".sn-avatar-videoFallback__label")?.textContent?.replace(/\s+/g, " ").trim(),
    hasVideo: Boolean(document.querySelector(".sn-avatar-videoFallback video")),
    caption: document.querySelector(".sn-avatar-videoFallback")?.textContent?.includes("How can I help you today?"),
  }));
  await page.screenshot({ path: `${OUT}/pwa-avatar-video-fallback.png`, fullPage: true });
  console.log(JSON.stringify({ fallback }, null, 2));
  await context.close();
}

{
  const { context, page } = await makePage(1440, 900, {}, "/response");
  await page.waitForSelector(".sn-avatar-card", { timeout: 20_000 });
  await page.waitForSelector(".sn-avatar-stage svg", { timeout: 20_000 });
  const response = await avatarMetrics(page);
  await page.screenshot({ path: `${OUT}/pwa-avatar-response.png`, fullPage: true });
  console.log(JSON.stringify({ response }, null, 2));
  await context.close();
}

await browser.close();
console.log("ERRORS:", errors.length ? JSON.stringify(errors.slice(0, 8), null, 2) : "(none)");

