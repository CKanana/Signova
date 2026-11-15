// Browser verification v3 for Signova PWA - final
import { chromium } from "playwright-core";
import fs from "fs";
import path from "path";

const BASE_URL = "http://localhost:4173";
const results = [];

async function check(name, ok, detail = "") {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? `  -> ${detail}` : ""}`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    args: ["--disable-gpu", "--no-sandbox", "--use-gl=swiftshader"]
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    userAgent: "Signova-PWA-Verification/1.0"
  });
  const page = await context.newPage();

  const consoleErrors = [];
  const pageErrors = [];
  page.on("console", msg => { if (msg.type() === "error") consoleErrors.push(msg.text()); });
  page.on("pageerror", err => pageErrors.push(err.message));

  // 1. Application load
  console.log("\n=== 1. Application load ===");
  let status = "none";
  try {
    const response = await page.goto(BASE_URL, { waitUntil: "networkidle", timeout: 30000 });
    status = response ? response.status() : "none";
    await check("HTTP 200", status === 200, "status=" + status);
    await check("Page title = 'Signova'", (await page.title()) === "Signova", "title=" + (await page.title()));
    await check("Manifest endpoint reachable", (await page.evaluate(async () => {
      const r = await fetch("/manifest.webmanifest");
      return r.ok && r.status === 200;
    })) === true, "manifest reachable");
  } catch (e) { await check("Application loads", false, e.message); }

  await page.waitForTimeout(3000);

  // 2. Install banner / PWA state
  console.log("\n=== 2. Install banner / PWA state ===");
  const installState = await page.evaluate(() => {
    const b = document.querySelector("div[style*='installBanner']");
    const btns = Array.from(document.querySelectorAll("button")).map(b => b.textContent.trim());
    return { hasBanner: !!b, buttons: btns, bodyText: document.body.innerText.substring(0, 200) };
  });
  await check("Install banner visible", installState.hasBanner, "banner present");
  await check("Install button visible", installState.buttons.includes("Install"), "buttons=" + JSON.stringify(installState.buttons));

  // 3. Service worker
  console.log("\n=== 3. Service worker ===");
  const sw = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { registered: false, reason: "no SW API" };
    const regs = await navigator.serviceWorker.getRegistrations();
    return { registered: regs.length > 0, count: regs.length };
  });
  await check("SW registered", sw.registered, "count=" + sw.count);

  // 4. Asset availability (fetch)
  console.log("\n=== 4. Asset availability (fetch) ===");
  const assets = {
    "TFLite model": "/model/signova_model.tflite",
    "labels.json": "/model/labels.json",
    "model_info.json": "/model/model_info.json",
    "WASM vision internal": "/wasm-vision/vision_wasm_internal.wasm",
    "WASM vision module": "/wasm-vision/vision_wasm_module_internal.wasm",
    "hand_landmarker.task": "/models/hand_landmarker.task",
  };
  for (const [key, url] of Object.entries(assets)) {
    try {
      const r = await fetch(BASE_URL + url, { mode: "cors", cache: "no-cache" });
      await check(`Asset: ${key}`, r.ok, "HTTP " + r.status);
    } catch (e) {
      await check(`Asset: ${key}`, false, "fetch failed: " + e.message);
    }
  }

  // 5. Console/page errors
  console.log("\n=== 5. Console / page errors ===");
  await check("No console errors", consoleErrors.length === 0, consoleErrors.join(" | "));
  await check("No page errors", pageErrors.length === 0, pageErrors.join(" | "));

  // 6. Camera capabilities
  console.log("\n=== 6. Camera capabilities ===");
  const cam = await page.evaluate(() => ({
    hasMediaDevices: !!navigator.mediaDevices,
    hasGetUserMedia: !!navigator.mediaDevices?.getUserMedia,
    hasPermissionAPI: "permissionStatus" in navigator && !!navigator.permissions?.query,
    webkitGetUserMedia: !!navigator.webkitGetUserMedia
  }));
  await check("getUserMedia available", cam.hasGetUserMedia);

  // 7. Request camera
  console.log("\n=== 7. Camera stream request ===");
  let stream = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    const vTrack = stream.getVideoTracks()[0];
    await check("Video track created", !!vTrack, "label=" + (vTrack ? vTrack.label : "none"));
    await check("Track enabled", vTrack ? vTrack.enabled : false, "enabled=" + (vTrack ? vTrack.enabled : "n/a"));
    await check("Stream has video tracks", stream.getTracks().some(t => t.kind === "video"));
    console.log("Camera permission state: prompt");
    if (stream) {
      const info = await page.evaluate(() => {
        const t = stream.getVideoTracks()[0];
        return t ? { label: t.label, kind: t.kind, readyState: t.readyState } : null;
      });
      console.log("Video track info:", JSON.stringify(info));
    }
  } catch (e) {
    await check("Camera stream created", false, e.message);
  }
  if (stream) { stream.getTracks().forEach(t => t.stop()); }

  // 8. App rendered state
  console.log("\n=== 8. App rendered state ===");
  const appState = await page.evaluate(() => {
    const visible = Array.from(document.querySelectorAll("div, section, main, header, footer"))
      .filter(el => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && window.getComputedStyle(el).display !== "none"; });
    return {
      totalVisible: visible.length,
      bodyText: document.body.innerText.substring(0, 300),
      buttons: Array.from(document.querySelectorAll("button")).map(b => b.textContent.trim()).join("|"),
      installBanner: !!document.querySelector("div[style*='installBanner']")
    };
  });
  await check("App renders content", appState.totalVisible > 0, "visible=" + appState.totalVisible);

  // 9. Screenshot
  const screenshotPage = await browser.newPage();
  try {
    await screenshotPage.screenshot({ path: "/tmp/signova-camera-screenshot.png" });
    console.log("Screenshot saved: /tmp/signova-camera-screenshot.png");
  } catch (e) { console.log("Screenshot not available:", e.message); }
  await screenshotPage.close();

  await browser.close();

  // Summary
  console.log("\n=== SUMMARY ===");
  const passed = results.filter(r => r.ok).length;
  const failed = results.filter(r => !r.ok).length;
  console.log("Total: " + results.length + "  Passed: " + passed + "  Failed: " + failed);
  for (const r of results) { if (!r.ok) console.log("  FAILED:", r.name, "->", r.detail); }

  const jsonPath = path.resolve("/tmp/signova-browser-results.json");
  fs.writeFileSync(jsonPath, JSON.stringify({ results, consoleErrors, pageErrors }, null, 2));
  console.log("\nResults written to", jsonPath);

  return { passed, failed, results };
}

main().catch(e => { console.error("FATAL:", e); process.exit(1); });
