import { chromium } from "playwright";

const URL = process.env.PWA_PREVIEW_URL ?? "http://localhost:4173/";
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const sw = await page.evaluate(async () => {
  if (!("serviceWorker" in navigator)) return { supported: false };
  const regs = await navigator.serviceWorker.getRegistrations();
  const ready = await Promise.race([
    navigator.serviceWorker.ready.then((r) => ({ scope: r.scope, active: Boolean(r.active) })),
    new Promise((resolve) => setTimeout(() => resolve(null), 12000)),
  ]);
  return { supported: true, registrations: regs.length, ready };
});

const client = await context.newCDPSession(page);
await client.send("Page.enable");
const manifest = await client.send("Page.getAppManifest").catch((e) => ({ error: e.message }));
const installability = await client.send("Page.getInstallabilityErrors").catch((e) => ({ error: e.message }));

const cacheInfo = await page.evaluate(async () => {
  const keys = await caches.keys();
  const wanted = [
    "signova_model.tflite",
    "labels.json",
    "model_info.json",
    "hand_landmarker.task",
    "litert_wasm",
    "vision_wasm",
    "index.html",
  ];
  const found = Object.fromEntries(wanted.map((w) => [w, false]));
  const entries = [];
  for (const key of keys) {
    const cache = await caches.open(key);
    const cached = await cache.keys();
    for (const req of cached) {
      entries.push(req.url);
      for (const w of wanted) {
        if (req.url.includes(w)) found[w] = true;
      }
    }
  }
  return { cacheKeys: keys, entryCount: entries.length, found };
});

let offline = { attempted: false };
try {
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForTimeout(1500);
  offline = {
    attempted: true,
    title: await page.title(),
    rootTextLength: (await page.locator("#root").innerText()).length,
  };
} catch (e) {
  offline = { attempted: true, error: e.message };
} finally {
  await context.setOffline(false);
}

console.log(JSON.stringify({
  sw,
  manifest: { url: manifest.url, errors: manifest.errors },
  installability,
  cacheInfo,
  offline,
  errors,
}, null, 2));

await page.screenshot({ path: "workspace/preview-install-check.png" });
await browser.close();
