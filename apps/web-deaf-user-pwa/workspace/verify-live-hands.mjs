import { chromium } from "playwright";

const BASE = "http://localhost:5175";
const OUT = "workspace";
const VIDEO = "C:/Users/kanan/OneDrive/Desktop/Signova/apps/web-deaf-user-pwa/workspace/hands-test.y4m";

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

const sessionId = "session-hands-test";
const startedAt = new Date(Date.now() - 8_000).toISOString();

const session = {
  _id: sessionId,
  organization: org._id,
  teller: teller._id,
  deafUser: "deaf-test",
  method: "sign",
  status: "ACTIVE",
  pairingCode: "123456",
  messageCount: 1,
  startedAt,
};

const conversations = [
  {
    _id: "msg-1",
    sessionId,
    sender: "STAFF",
    text: "How can I help you today?",
    method: "speech",
    isConfirmed: true,
    timestamp: new Date(Date.now() - 7_000).toISOString(),
    animationUrl: null,
    generationStatus: "completed",
    animation: null,
  },
];

const browser = await chromium.launch({
  headless: true,
  args: [
    "--use-fake-ui-for-media-stream",
    "--use-fake-device-for-media-stream",
    `--use-file-for-fake-video-capture=${VIDEO}`,
    "--autoplay-policy=no-user-gesture-required",
  ],
});

const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  permissions: ["camera"],
  locale: "en-US",
});

await context.addInitScript(() => {
  try {
    localStorage.setItem("signova.accessToken", "test-token");
    localStorage.setItem("signova-installed", "1");
  } catch {}
});

const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
page.on("console", (message) => {
  if (message.type() === "error" && !message.text().startsWith("INFO:") && !message.text().startsWith("WARNING:")) {
    errors.push(`console.error: ${message.text()}`);
  }
});

await page.route("**/api/kiosk/organization", (route) => route.fulfill({ json: { organization: org } }));
await page.route("**/api/kiosk/tellers", (route) =>
  route.fulfill({ json: { organizationId: org._id, tellers: [teller] } }),
);
await page.route("**/api/sessions/current", (route) => route.fulfill({ json: { session } }));
await page.route(`**/api/sessions/${sessionId}/messages`, async (route) => {
  if (route.request().method() === "POST") {
    const body = route.request().postDataJSON();
    const message = {
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
    };
    conversations.push(message);
    return route.fulfill({ json: { message } });
  }
  return route.fulfill({ json: { messages: conversations } });
});
await page.route("**/socket.io/**", (route) => route.abort());
await page.route("**/api/sessions/*/status", (route) =>
  route.fulfill({ json: { session: { ...session, status: "ENDED" } } }),
);

await page.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
await page.waitForSelector(".sn-live-shell", { timeout: 30_000 });
await page.waitForFunction(
  () => {
    const video = document.querySelector(".sn-camera__video");
    return video && video.readyState >= 2 && video.videoWidth > 0;
  },
  { timeout: 20_000 },
);

await page.waitForFunction(
  () => {
    const text = [...document.querySelectorAll(".sn-camera__pill")].map((el) => el.textContent ?? "").join(" ");
    return /hand?s? detected/i.test(text) || /Signing/.test(text);
  },
  { timeout: 30_000 },
);

await page.waitForTimeout(2500);

const detected = await page.evaluate(() => {
  const canvas = document.querySelector(".sn-camera__canvas");
  const ctx = canvas.getContext("2d");
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let opaque = 0;
  for (let i = 3; i < data.length; i += 4) {
    if (data[i] !== 0) opaque++;
  }
  return {
    pills: [...document.querySelectorAll(".sn-camera__pill")].map((el) => el.textContent?.trim()),
    confidence: [...document.querySelectorAll(".sn-camera__confidence")].map((el) => el.textContent?.trim()),
    opaqueCanvasPixels: opaque,
    canvasWidth: canvas.width,
    canvasHeight: canvas.height,
    video: (() => {
      const v = document.querySelector(".sn-camera__video");
      return { width: v.videoWidth, height: v.videoHeight, readyState: v.readyState };
    })(),
  };
});

await page.screenshot({ path: `${OUT}/live-desktop-hands.png`, fullPage: true });

await page.getByRole("button", { name: "Done signing" }).click();
await page.waitForSelector(".sn-review", { timeout: 30_000 });
await page.waitForTimeout(300);

const review = await page.evaluate(() => ({
  confidence: document.querySelector(".sn-review__confidence")?.textContent?.trim(),
  draft: document.querySelector(".sn-review__input")?.value,
  note: document.querySelector(".sn-review__note")?.textContent?.trim() ?? null,
  signedChips: [...document.querySelectorAll(".sn-signs__chip")].map((el) => el.textContent),
  doneDisabled: document.querySelector(".sn-done")?.disabled,
}));

await page.locator(".sn-review__input").fill("hello");
await page.getByRole("button", { name: "Send to counter" }).click();
await page.waitForTimeout(1800);

const afterSend = await page.evaluate(() => ({
  messages: [...document.querySelectorAll(".sn-msg__bubble")].map((el) => el.textContent),
  delivery: [...document.querySelectorAll(".sn-msg__status")].map((el) => el.textContent?.trim()),
  reviewGone: !document.querySelector(".sn-review"),
  signedChips: [...document.querySelectorAll(".sn-signs__chip")].map((el) => el.textContent),
  pills: [...document.querySelectorAll(".sn-camera__pill")].map((el) => el.textContent?.trim()),
}));

await page.screenshot({ path: `${OUT}/live-desktop-sent.png`, fullPage: true });

await page.getByRole("button", { name: "Use text" }).click();
await page.waitForTimeout(1200);
const textNavigation = await page.evaluate(() => ({
  path: location.pathname,
  videos: document.querySelectorAll("video").length,
  canvases: document.querySelectorAll("canvas").length,
  liveBodyClass: document.body.classList.contains("sn-live-scrollable"),
}));

console.log(
  JSON.stringify({ detected, review, afterSend, textNavigation, errors }, null, 2),
);

{
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    permissions: ["camera"],
    locale: "en-US",
  });
  await mobileContext.addInitScript(() => {
    try {
      localStorage.setItem("signova.accessToken", "test-token");
      localStorage.setItem("signova-installed", "1");
    } catch {}
  });
  const mobilePage = await mobileContext.newPage();
  mobilePage.on("pageerror", (error) => errors.push(`mobile pageerror: ${error.message}`));
  await mobilePage.route("**/api/kiosk/organization", (route) =>
    route.fulfill({ json: { organization: org } }),
  );
  await mobilePage.route("**/api/kiosk/tellers", (route) =>
    route.fulfill({ json: { organizationId: org._id, tellers: [teller] } }),
  );
  await mobilePage.route("**/api/sessions/current", (route) =>
    route.fulfill({ json: { session } }),
  );
  await mobilePage.route(`**/api/sessions/${sessionId}/messages`, (route) =>
    route.fulfill({ json: { messages: conversations.slice(0, 1) } }),
  );
  await mobilePage.route("**/socket.io/**", (route) => route.abort());
  await mobilePage.route("**/api/sessions/*/status", (route) =>
    route.fulfill({ json: { session: { ...session, status: "ENDED" } } }),
  );

  await mobilePage.goto(`${BASE}/live`, { waitUntil: "domcontentloaded" });
  await mobilePage.waitForSelector(".sn-live-shell", { timeout: 30_000 });
  await mobilePage.waitForFunction(
    () => {
      const video = document.querySelector(".sn-camera__video");
      return video && video.readyState >= 2 && video.videoWidth > 0;
    },
    { timeout: 20_000 },
  );
  await mobilePage.waitForFunction(
    () => {
      const text = document.querySelector(".sn-camera__pill")?.textContent ?? "";
      return /hand?s? · Signing|hand?s? detected|hand?s? ·/.test(text);
    },
    { timeout: 30_000 },
  );
  await mobilePage.waitForTimeout(2500);

  const mobileDetected = await mobilePage.evaluate(() => {
    const canvas = document.querySelector(".sn-camera__canvas");
    const ctx = canvas.getContext("2d");
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    let opaque = 0;
    for (let i = 3; i < data.length; i += 4) {
      if (data[i] !== 0) opaque++;
    }
    const video = document.querySelector(".sn-camera__video");
    return {
      pill: document.querySelector(".sn-camera__pill")?.textContent?.trim(),
      confidence: [...document.querySelectorAll(".sn-camera__confidence")].map((el) => el.textContent?.trim()),
      opaqueCanvasPixels: opaque,
      video: { width: video.videoWidth, height: video.videoHeight },
      canvas: { width: canvas.width, height: canvas.height },
      scrollHeight: Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      innerHeight: window.innerHeight,
      overflowX: document.documentElement.scrollWidth > window.innerWidth,
    };
  });

  await mobilePage.screenshot({ path: `${OUT}/live-mobile-hands.png`, fullPage: true });

  await mobilePage.getByRole("button", { name: "Done signing" }).click();
  await mobilePage.waitForSelector(".sn-review", { timeout: 30_000 });
  const mobileReview = await mobilePage.evaluate(() => ({
    reviewVisible: Boolean(document.querySelector(".sn-review")),
    reviewTop: document.querySelector(".sn-review")?.getBoundingClientRect().top,
    viewport: window.innerHeight,
    sendLabel: document.querySelector(".sn-review__send")?.textContent?.trim(),
    doneDisabled: document.querySelector(".sn-done")?.disabled,
    labels: [...document.querySelectorAll(".sn-round")].map((el) => el.textContent?.trim()),
    signsHidden: getComputedStyle(document.querySelector(".sn-signs")).display === "none",
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
  }));
  await mobilePage.screenshot({ path: `${OUT}/live-mobile-review.png`, fullPage: true });

  console.log(JSON.stringify({ mobileDetected, mobileReview }, null, 2));
  await mobileContext.close();
}

await browser.close();
