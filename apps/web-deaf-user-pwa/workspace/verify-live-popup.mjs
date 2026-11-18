import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:5175";
const OUT = "workspace";
const VIDEO_PATH =
  "C:/Users/kanan/OneDrive/Desktop/Signova/apps/web-deaf-user-pwa/workspace/sample-transcode.mp4";

const org = {
  _id: "org-test",
  name: "Nairobi County Health Centre",
  shortName: "NCHC",
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

const sessionId = "session-popup-test";
const session = {
  _id: sessionId,
  organization: org._id,
  teller: teller._id,
  deafUser: "deaf-test",
  method: "sign",
  status: "ACTIVE",
  pairingCode: "123456",
  messageCount: 1,
  startedAt: new Date(Date.now() - 20_000).toISOString(),
};

const history = [
  {
    _id: "msg-history",
    sessionId,
    sender: "STAFF",
    text: "Welcome to Counter 1.",
    method: "speech",
    isConfirmed: true,
    timestamp: new Date(Date.now() - 15_000).toISOString(),
    animationUrl: null,
    generationStatus: "failed",
    animation: {
      status: "failed",
      url: null,
      durationMs: null,
      requestedAt: null,
      readyAt: null,
      error: "history",
    },
  },
];

const animationUrl = `/api/sessions/${sessionId}/messages/msg-live/animation`;
const liveMessage = {
  _id: "msg-live",
  sessionId,
  sender: "STAFF",
  text: "How can I help you today?",
  method: "speech",
  isConfirmed: true,
  timestamp: new Date().toISOString(),
  animationUrl: null,
  generationStatus: "pending",
  animation: {
    status: "pending",
    url: null,
    durationMs: null,
    requestedAt: new Date().toISOString(),
    readyAt: null,
    error: null,
  },
};

const videoBytes = readFileSync(VIDEO_PATH);
const authHeaders = [];

async function installRoutes(page) {
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
    route.fulfill({ json: { messages: history } }),
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
      authHeaders.push(route.request().headers()["authorization"] ?? null);
      return route.fulfill({
        status: 200,
        headers: {
          "content-type": "video/mp4",
          "content-length": String(videoBytes.length),
          "accept-ranges": "bytes",
          "access-control-allow-origin": BASE,
          "access-control-allow-headers": "authorization",
        },
        body: videoBytes,
      });
    },
  );
  await page.route("**/api/sessions/*/status", (route) =>
    route.fulfill({ json: { session: { ...session, status: "ENDED" } } }),
  );
}

async function installSocketMock(page, label, logs) {
  await page.routeWebSocket("**/socket.io/**", (ws) => {
    ws.onMessage((raw) => {
      const message = raw.toString();
      logs.push(`${label}: ${message.slice(0, 160)}`);
      if (message.startsWith("40")) {
        const hasNamespace = message.startsWith("40/signova");
        ws.send(
          hasNamespace
            ? '40/signova,{"sid":"mock-sid"}'
            : '40{"sid":"mock-sid"}',
        );
        setTimeout(() => {
          ws.send(
            `42/signova,["staff:message",${JSON.stringify(liveMessage)}]`,
          );
          setTimeout(() => {
            ws.send(
              `42/signova,["message:animation",${JSON.stringify({
                sessionId,
                messageId: "msg-live",
                status: "ready",
                url: animationUrl,
                durationMs: 2200,
              })}]`,
            );
          }, 6000);
        }, 700);
        return;
      }
      if (message.startsWith("2")) {
        ws.send("3");
      }
    });
    ws.send(
      '0{"sid":"mock-sid","upgrades":[],"pingInterval":60000,"pingTimeout":60000}',
    );
  });
}

async function bootstrap(context) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("signova.accessToken", "test-token");
      localStorage.setItem("signova-installed", "1");
    } catch {}
  });
}

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const errors = [];
const socketLogs = [];

{
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    permissions: ["camera"],
    locale: "en-US",
  });
  await bootstrap(context);
  const page = await context.newPage();
  page.on("pageerror", (error) => errors.push(`desktop pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (
      message.type() === "error" &&
      !message.text().startsWith("INFO:") &&
      !message.text().startsWith("WARNING:")
    ) {
      errors.push(`desktop console.error: ${message.text()}`);
    }
  });
  await installRoutes(page);
  await installSocketMock(page, "desktop", socketLogs);
  await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".sn-live-shell", { timeout: 30_000 });
  await page.waitForSelector(".sn-incoming", { timeout: 20_000 });

  const initial = await page.evaluate(() => ({
    title: document.querySelector(".sn-incoming__title")?.textContent?.trim(),
    subtitle: document.querySelector(".sn-incoming__subtitle")?.textContent?.trim(),
    text: document.querySelector(".sn-incoming__text")?.textContent?.trim(),
    signStatus: document.querySelector(".sn-incoming .sn-staff-sign__status")?.textContent?.trim(),
    buttons: [...document.querySelectorAll(".sn-incoming__actions button")].map((el) =>
      el.textContent?.trim(),
    ),
    backdropFilter: getComputedStyle(document.querySelector(".sn-incoming")).backdropFilter,
    liveBehind: Boolean(document.querySelector(".sn-live-shell")),
    pageLocked: getComputedStyle(document.body).overflow,
  }));

  await page.screenshot({ path: `${OUT}/live-popup-pending.png`, fullPage: true });

  await page.waitForFunction(
    () => {
      const video = document.querySelector(".sn-incoming .sn-staff-sign video");
      return video && video.readyState >= 2;
    },
    { timeout: 20_000 },
  );
  await page.waitForTimeout(500);

  const ready = await page.evaluate(() => {
    const video = document.querySelector(".sn-incoming .sn-staff-sign video");
    return {
      signStatus: document.querySelector(".sn-incoming .sn-staff-sign__status")?.textContent?.trim(),
      hasVideo: Boolean(video),
      videoSrc: video?.getAttribute("src"),
      readyState: video?.readyState,
      width: video?.videoWidth,
      height: video?.videoHeight,
      caption: document.querySelector(".sn-incoming .sn-staff-sign p")?.textContent?.trim(),
    };
  });

  await page.screenshot({ path: `${OUT}/live-popup-desktop.png`, fullPage: true });

  await page.getByRole("button", { name: "View conversation & reply" }).click();
  await page.waitForTimeout(600);
  const afterView = await page.evaluate(() => ({
    popupGone: !document.querySelector(".sn-incoming"),
    replyFocused: document.activeElement?.classList.contains("sn-reply-btn--sign"),
    convoVisible: Boolean(document.querySelector(".sn-convo")),
  }));

  console.log(
    JSON.stringify({ desktop: { initial, ready, afterView } }, null, 2),
  );
  await context.close();
}

{
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["camera"],
    locale: "en-US",
  });
  await bootstrap(mobileContext);
  const page = await mobileContext.newPage();
  page.on("pageerror", (error) => errors.push(`mobile pageerror: ${error.message}`));
  await installRoutes(page);
  await installSocketMock(page, "mobile", socketLogs);
  await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await page.waitForSelector(".sn-live-shell", { timeout: 30_000 });
  await page.waitForSelector(".sn-incoming", { timeout: 20_000 });

  const mobilePopup = await page.evaluate(() => ({
    title: document.querySelector(".sn-incoming__title")?.textContent?.trim(),
    text: document.querySelector(".sn-incoming__text")?.textContent?.trim(),
    actions: [...document.querySelectorAll(".sn-incoming__actions button")].map((el) =>
      el.textContent?.trim(),
    ),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    cardHeight: document.querySelector(".sn-incoming__card")?.getBoundingClientRect().height,
    viewport: window.innerHeight,
  }));
  await page.screenshot({ path: `${OUT}/live-popup-mobile.png`, fullPage: false });

  await page.getByRole("button", { name: "View conversation & reply" }).click();
  await page.waitForTimeout(700);
  const mobileAfterView = await page.evaluate(() => ({
    popupGone: !document.querySelector(".sn-incoming"),
    convoOpen: document.querySelector(".sn-convo")?.classList.contains("is-open"),
    replyButtons: [...document.querySelectorAll(".sn-reply-btn")].map((el) =>
      el.textContent?.trim(),
    ),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));

  console.log(
    JSON.stringify({ mobile: { mobilePopup, mobileAfterView } }, null, 2),
  );
  await mobileContext.close();
}

await browser.close();
console.log(
  JSON.stringify({ authHeaders, socketLogs, errors }, null, 2),
);



