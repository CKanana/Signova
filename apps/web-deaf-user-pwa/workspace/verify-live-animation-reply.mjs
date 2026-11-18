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

const sessionId = "session-animation-test";
const session = {
  _id: sessionId,
  organization: org._id,
  teller: teller._id,
  deafUser: "deaf-test",
  method: "sign",
  status: "ACTIVE",
  pairingCode: "123456",
  messageCount: 4,
  startedAt: new Date(Date.now() - 20_000).toISOString(),
};

const animationUrl = `/api/sessions/${sessionId}/messages/msg-2/animation`;
const flatAnimationUrl = `/api/sessions/${sessionId}/messages/msg-3/animation`;

const messages = [
  {
    _id: "msg-1",
    sessionId,
    sender: "STAFF",
    text: "How can I help you today?",
    method: "speech",
    isConfirmed: true,
    timestamp: new Date(Date.now() - 16_000).toISOString(),
    animationUrl: null,
    generationStatus: "failed",
    animation: {
      status: "skipped",
      url: null,
      durationMs: null,
      requestedAt: null,
      readyAt: null,
      error: "service_disabled",
    },
  },
  {
    _id: "msg-2",
    sessionId,
    sender: "STAFF",
    text: "Please take a seat at counter two.",
    method: "speech",
    isConfirmed: true,
    timestamp: new Date(Date.now() - 11_000).toISOString(),
    animationUrl,
    generationStatus: "completed",
    animation: {
      status: "ready",
      url: animationUrl,
      durationMs: 2200,
      requestedAt: new Date(Date.now() - 12_000).toISOString(),
      readyAt: new Date(Date.now() - 10_000).toISOString(),
      error: null,
    },
  },
  {
    _id: "msg-3",
    sessionId,
    sender: "STAFF",
    text: "Your documents are ready for collection.",
    method: "speech",
    isConfirmed: true,
    timestamp: new Date(Date.now() - 6_000).toISOString(),
    animationUrl: flatAnimationUrl,
    generationStatus: "completed",
  },
  {
    _id: "msg-4",
    sessionId,
    sender: "USER",
    text: "help",
    method: "sign",
    confidence: 0.92,
    isConfirmed: true,
    timestamp: new Date(Date.now() - 3_000).toISOString(),
    animationUrl: null,
    generationStatus: "completed",
    animation: null,
  },
];

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
    route.fulfill({ json: { messages } }),
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
  await page.route("**/socket.io/**", (route) => route.abort());
  await page.route("**/api/sessions/*/status", (route) =>
    route.fulfill({ json: { session: { ...session, status: "ENDED" } } }),
  );
}

async function bootstrap(context) {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("signova.accessToken", "test-token");
      localStorage.setItem("signova-installed", "1");
    } catch {}
  });
}

async function waitForLive(page) {
  await page.waitForSelector(".sn-live-shell", { timeout: 30_000 });
  await page.waitForSelector(".sn-staff-sign", {
    state: "attached",
    timeout: 20_000,
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
  await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await waitForLive(page);

  await page.waitForFunction(
    () => document.querySelectorAll(".sn-staff-sign video").length >= 2,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(1500);

  const desktop = await page.evaluate(() => ({
    cards: [...document.querySelectorAll(".sn-staff-sign")].map((card) => ({
      status: card.querySelector(".sn-staff-sign__status")?.textContent?.trim(),
      caption: card.querySelector(".sn-sign-caption, p")?.textContent?.trim(),
      hasVideo: Boolean(card.querySelector("video")),
      videoSrc: card.querySelector("video")?.getAttribute("src"),
      generate: Boolean(card.querySelector(".sn-staff-sign__generate")),
    })),
    replyButtons: [...document.querySelectorAll(".sn-reply-btn")].map((el) =>
      el.textContent?.trim(),
    ),
    badge: document.querySelector(".sn-convo__signBadge")?.textContent?.trim(),
    videos: [...document.querySelectorAll(".sn-staff-sign video")].map((video) => ({
      readyState: video.readyState,
      width: video.videoWidth,
      height: video.videoHeight,
      duration: Number.isFinite(video.duration) ? video.duration : null,
      error: video.error ? { code: video.error.code, message: video.error.message } : null,
    })),
    animationEvents: performance.getEntriesByType("resource")
      .filter((entry) => entry.name.includes("/animation"))
      .length,
  }));

  await page.getByRole("button", { name: "Reply with sign" }).click();
  await page.waitForSelector(".sn-reply-banner", { timeout: 5_000 });
  const replySign = await page.evaluate(() => ({
    banner: document.querySelector(".sn-reply-banner__label")?.textContent?.trim(),
    text: document.querySelector(".sn-reply-banner__text")?.textContent?.trim(),
    convoStillVisible: Boolean(document.querySelector(".sn-convo")),
    doneFocused: document.activeElement?.classList.contains("sn-done"),
  }));
  await page.screenshot({ path: `${OUT}/live-desktop-animation.png`, fullPage: true });

  console.log(
    JSON.stringify(
      { desktop, replySign, authHeaders, errors },
      null,
      2,
    ),
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
  await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await waitForLive(page);

  const collapsed = await page.evaluate(() => ({
    convo: document.querySelector(".sn-convo")?.className,
    replyButtons: [...document.querySelectorAll(".sn-reply-btn")].map((el) =>
      el.textContent?.trim(),
    ),
    preview: document.querySelector(".sn-convo__previewText")?.textContent?.trim(),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    scrollHeight: Math.max(
      document.documentElement.scrollHeight,
      document.body.scrollHeight,
    ),
    innerHeight: window.innerHeight,
  }));

  await page.getByRole("button", { name: "Open conversation" }).click();
  await page.waitForTimeout(800);
  await page.waitForFunction(
    () => document.querySelectorAll(".sn-staff-sign video").length >= 2,
    { timeout: 20_000 },
  );

  const open = await page.evaluate(() => ({
    convo: document.querySelector(".sn-convo")?.className,
    cards: [...document.querySelectorAll(".sn-staff-sign__status")].map((el) =>
      el.textContent?.trim(),
    ),
    replyButtonsVisible: [...document.querySelectorAll(".sn-reply-btn")].filter(
      (el) => el.getBoundingClientRect().height > 0,
    ).length,
    videoCount: document.querySelectorAll(".sn-staff-sign video").length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await page.screenshot({ path: `${OUT}/live-mobile-animation.png`, fullPage: false });

  await page.getByRole("button", { name: "Reply with sign" }).click();
  await page.waitForTimeout(900);
  const afterReplySign = await page.evaluate(() => ({
    convo: document.querySelector(".sn-convo")?.className,
    banner: document.querySelector(".sn-reply-banner__label")?.textContent?.trim(),
    bannerText: document.querySelector(".sn-reply-banner__text")?.textContent?.trim(),
    doneFocused: document.activeElement?.classList.contains("sn-done"),
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await page.screenshot({ path: `${OUT}/live-mobile-reply-sign.png`, fullPage: true });

  await page.getByRole("button", { name: "Reply with text" }).click();
  await page.waitForTimeout(900);
  const afterReplyText = await page.evaluate(() => ({
    path: location.pathname,
    hasTextInput: Boolean(document.querySelector("textarea, input[type='text']")),
    liveStillMounted: Boolean(document.querySelector(".sn-live-shell")),
  }));

  console.log(
    JSON.stringify(
      { collapsed, open, afterReplySign, afterReplyText, authHeaders, errors },
      null,
      2,
    ),
  );
  await mobileContext.close();
}

await browser.close();

