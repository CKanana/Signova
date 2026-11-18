import { chromium } from "playwright";

const BASE = "http://localhost:5175";
const OUT = "workspace";

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

const sessionId = "session-live-test";
const startedAt = new Date(Date.now() - 12_000).toISOString();

const session = {
  _id: sessionId,
  organization: org._id,
  teller: teller._id,
  deafUser: "deaf-test",
  method: "sign",
  status: "ACTIVE",
  pairingCode: "123456",
  messageCount: 2,
  startedAt,
};

const messages = [
  {
    _id: "msg-1",
    sessionId,
    sender: "STAFF",
    text: "How can I help you today?",
    method: "speech",
    isConfirmed: true,
    timestamp: new Date(Date.now() - 9_000).toISOString(),
    animationUrl: null,
    generationStatus: "completed",
    animation: null,
  },
  {
    _id: "msg-2",
    sessionId,
    sender: "USER",
    text: "help",
    method: "sign",
    confidence: 0.93,
    isConfirmed: true,
    timestamp: new Date(Date.now() - 6_000).toISOString(),
    animationUrl: null,
    generationStatus: "completed",
    animation: null,
  },
];

async function installRoutes(page) {
  await page.route("**/api/kiosk/organization", (route) =>
    route.fulfill({ json: { organization: org } }),
  );
  await page.route("**/api/kiosk/tellers", (route) =>
    route.fulfill({
      json: { organizationId: org._id, tellers: [teller] },
    }),
  );
  await page.route("**/api/sessions/current", (route) =>
    route.fulfill({ json: { session } }),
  );
  await page.route(`**/api/sessions/${sessionId}/messages`, async (route) => {
    if (route.request().method() === "POST") {
      const body = route.request().postDataJSON();
      return route.fulfill({
        json: {
          message: {
            _id: `msg-${Date.now()}`,
            sessionId,
            sender: "USER",
            text: body.text,
            method: body.method ?? "sign",
            confidence: body.confidence,
            isConfirmed: true,
            timestamp: new Date().toISOString(),
            animationUrl: null,
            generationStatus: "completed",
            animation: null,
          },
        },
      });
    }
    return route.fulfill({ json: { messages } });
  });
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

function wireLogs(page, label, errors) {
  page.on("pageerror", (error) => errors.push(`${label} pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") {
      errors.push(`${label} console.error: ${message.text()}`);
    }
  });
}

async function waitForLive(page) {
  await page.waitForSelector(".sn-live-shell", { timeout: 30_000 });
  await page.waitForSelector(".sn-camera__video", { timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const video = document.querySelector(".sn-camera__video");
      return video && video.readyState >= 2 && video.videoWidth > 0;
    },
    { timeout: 20_000 },
  );
}

async function metrics(page) {
  return page.evaluate(() => {
    const video = document.querySelector(".sn-camera__video");
    const canvas = document.querySelector(".sn-camera__canvas");
    const stage = document.querySelector(".sn-camera__stage");
    const html = document.documentElement;
    return {
      url: location.pathname,
      header: document.querySelector(".sn-live-header__counter")?.textContent,
      meta: document.querySelector(".sn-live-header__meta")?.textContent,
      timer: document.querySelector(".sn-live-timer")?.textContent,
      pills: [...document.querySelectorAll(".sn-camera__pill")].map((el) => el.textContent?.trim()),
      video: video
        ? {
            readyState: video.readyState,
            width: video.videoWidth,
            height: video.videoHeight,
            cssWidth: video.clientWidth,
            cssHeight: video.clientHeight,
          }
        : null,
      canvas: canvas
        ? {
            width: canvas.width,
            height: canvas.height,
            cssWidth: canvas.clientWidth,
            cssHeight: canvas.clientHeight,
          }
        : null,
      stage: stage
        ? { width: stage.clientWidth, height: stage.clientHeight }
        : null,
      signs: [...document.querySelectorAll(".sn-signs__chip")].map((el) => el.textContent),
      messages: [...document.querySelectorAll(".sn-msg__bubble")].map((el) => el.textContent),
      overflowX: html.scrollWidth > window.innerWidth,
      scrollWidth: html.scrollWidth,
      innerWidth: window.innerWidth,
      scrollHeight: Math.max(html.scrollHeight, document.body.scrollHeight),
      bodyHeight: document.body.getBoundingClientRect().height,
      bodyOverflowY: getComputedStyle(document.body).overflowY,
      convo: document.querySelector(".sn-convo")?.className,
      doneText: document.querySelector(".sn-done")?.textContent?.replace(/\s+/g, " ").trim(),
      controls: [...document.querySelectorAll(".sn-round")].map((el) => el.textContent?.trim()),
    };
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
  wireLogs(page, "desktop", errors);
  await installRoutes(page);
  await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await waitForLive(page);
  await page.waitForTimeout(9000);

  const first = await metrics(page);
  await page.screenshot({ path: `${OUT}/live-desktop.png`, fullPage: true });

  const timerBefore = first.timer;
  await page.waitForTimeout(2100);
  const timerAfter = await page.locator(".sn-live-timer").textContent();

  await page.getByRole("button", { name: "Camera", exact: true }).click();
  await page.waitForTimeout(600);
  const cameraOff = {
    placeholder: await page.locator(".sn-camera__placeholderTitle").textContent(),
    pill: await page.locator(".sn-camera__pill").first().textContent(),
    canvasCleared: await page.evaluate(() => {
      const canvas = document.querySelector(".sn-camera__canvas");
      const ctx = canvas.getContext("2d");
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
      let opaque = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] !== 0) opaque++;
      }
      return opaque === 0;
    }),
  };
  await page.getByRole("button", { name: "Turn camera on" }).click();
  await page.waitForTimeout(4000);
  const cameraOnAgain = await page.locator(".sn-camera__video").evaluate((video) => ({
    readyState: video.readyState,
    width: video.videoWidth,
  }));

  await page.getByRole("button", { name: "Redo" }).click();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "End session" }).click();
  const dialogVisible = await page.getByRole("dialog").isVisible();
  await page.getByRole("button", { name: "Cancel" }).click();

  console.log(
    JSON.stringify(
      {
        desktop: first,
        timerTicked: timerBefore !== timerAfter,
        timerBefore,
        timerAfter,
        cameraOff,
        cameraOnAgain,
        dialogVisible,
      },
      null,
      2,
    ),
  );
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 900, height: 1000 },
    permissions: ["camera"],
    locale: "en-US",
  });
  await bootstrap(context);
  const page = await context.newPage();
  wireLogs(page, "tablet", errors);
  await installRoutes(page);
  await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await waitForLive(page);
  await page.waitForTimeout(5000);
  const tablet = await metrics(page);
  await page.screenshot({ path: `${OUT}/live-tablet.png`, fullPage: true });
  console.log(JSON.stringify({ tablet }, null, 2));
  await context.close();
}

{
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["camera"],
    locale: "en-US",
  });
  await bootstrap(context);
  const page = await context.newPage();
  wireLogs(page, "mobile", errors);
  await installRoutes(page);
  await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await waitForLive(page);
  await page.waitForTimeout(5000);

  const mobileCollapsed = await metrics(page);
  await page.screenshot({ path: `${OUT}/live-mobile.png`, fullPage: true });

  await page.getByRole("button", { name: "Open conversation" }).click();
  await page.waitForTimeout(500);
  const mobileOpen = await page.evaluate(() => {
    const convo = document.querySelector(".sn-convo");
    const messages = [...document.querySelectorAll(".sn-msg__bubble")].map((el) => el.textContent);
    return {
      convo: convo?.className,
      height: convo?.getBoundingClientRect().height,
      viewport: window.innerHeight,
      messages,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });
  await page.screenshot({ path: `${OUT}/live-mobile-conversation.png`, fullPage: false });

  console.log(JSON.stringify({ mobileCollapsed, mobileOpen }, null, 2));
  await context.close();
}

await browser.close();
console.log("ERRORS:", errors.length ? JSON.stringify(errors, null, 2) : "(none)");
