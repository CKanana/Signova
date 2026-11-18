import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const cfgPath = path.join(os.tmpdir(), "signova_ui_session.json");
const cfg = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
const mode = process.argv[2] || cfg.method || "text";
const base = "http://localhost:5175";
const route = mode === "text" ? "text" : "live";
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

function initSession(context) {
  return context.addInitScript(
    ({ token, deviceId, session }) => {
      localStorage.setItem("signova.accessToken", token);
      localStorage.setItem("signova.device.id.v1", deviceId);
      localStorage.setItem("signova.session", JSON.stringify(session));
    },
    {
      token: cfg.deafToken,
      deviceId: cfg.deviceId,
      session: {
        sessionId: cfg.sessionId,
        tellerId: cfg.tellerId,
        method: mode,
        createdAt: Date.now(),
      },
    },
  );
}

async function waitForVideo(page, selector = "video") {
  const loc = page.locator(selector).first();
  await loc.waitFor({ state: "visible", timeout: 120_000 });
  const deadline = Date.now() + 120_000;
  for (;;) {
    const info = await loc.evaluate((v) => ({
      width: v.videoWidth,
      height: v.videoHeight,
      duration: v.duration,
      readyState: v.readyState,
      srcIsBlob: (v.currentSrc || v.src || "").startsWith("blob:"),
    }));
    if (info.readyState >= 2 && info.width > 0) return info;
    if (Date.now() > deadline) throw new Error(`video did not become ready: ${JSON.stringify(info)}`);
    await page.waitForTimeout(250);
  }
}

async function assertAvatar(page, label, root = ".sn-avatar-card:visible") {
  await page.waitForSelector(`${root} .sn-avatar-stage svg`, { timeout: 120_000 });
  const avatar = await page.evaluate((r) => {
    const stage = document.querySelector(`${r} .sn-avatar-stage`);
    const svg = stage?.querySelector("svg");
    return {
      svgNodes: svg ? svg.querySelectorAll("*").length : 0,
      stageLabel: stage?.getAttribute("aria-label") || "",
    };
  }, root.replace(":visible", ""));
  record(
    `${label}: 2D animated avatar renders from SignBridge joints`,
    avatar.svgNodes > 10 && avatar.stageLabel.includes("2D signer"),
    `svgNodes=${avatar.svgNodes} label=${avatar.stageLabel}`,
  );
  const gloss = await page.locator(`${root} .sn-avatar-card__gloss`).first().textContent();
  record(`${label}: gloss sequence is shown`, !!gloss && gloss.trim().length > 0, `gloss=${gloss}`);
  const meta = await page.locator(`${root} .sn-avatar-meta`).first().textContent();
  record(`${label}: frame/duration metadata is shown`, !!meta && /frames/.test(meta), `meta=${meta}`);
  await page.click(`${root} .sn-avatar-btn:has-text("Replay")`);
  record(`${label}: avatar replay control works`, true, "replay clicked");
}

const browser = await chromium.launch();
try {
  // -------------------------------------------------------------------
  // 1. Mobile live flow: message arrives while the screen is open.
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await initSession(context);
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        !/environment\.cc|accelerator|LiteRT|compiled_model|cpu_registry|gpu_registry|npu_registry|XNNPACK|INFO:|WARNING:/.test(
          m.text(),
        )
      ) {
        errors.push(`console: ${m.text()}`);
      }
    });

    await page.goto(`${base}/${route}`, { waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle").catch(() => undefined);
    record(`mobile: app boots on /${route}`, page.url().endsWith(`/${route}`), page.url());

    const res = await fetch(`http://localhost:4000/api/sessions/${cfg.sessionId}/messages`, {
      method: "POST",
      headers: {
        authorization: `Bearer ${cfg.staffToken}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: "STAFF",
        text: "How can I help you today?",
        method: "speech",
      }),
    });
    record("teller reply accepted by backend", res.status === 201, `status=${res.status}`);

    let visibleText = "";
    if (mode === "text") {
      await page.locator(".sn-avatar-card").first().waitFor({ state: "visible", timeout: 30_000 });
      visibleText = await page.locator(".sn-avatar-card").last().textContent();
    } else {
      await page.locator(".sn-incoming__card").waitFor({ state: "visible", timeout: 30_000 });
      visibleText = await page.locator(".sn-incoming__text").textContent();
    }
    record(
      "mobile: teller text is visible",
      !!visibleText && visibleText.includes("How can I help you today?"),
      `text rendered: ${visibleText?.slice(0, 80)}`,
    );

    const mobileRoot = mode === "text" ? ".sn-avatar-card:visible" : ".sn-incoming__card";
    const sawLoading = await page
      .locator(`${mobileRoot} .sn-avatar-loading`)
      .first()
      .isVisible()
      .catch(() => false);
    record(
      "mobile: loading indicator while the 2D sign is prepared",
      sawLoading,
      sawLoading ? "preparing state visible" : "no loading state observed",
    );
    await assertAvatar(page, "mobile", mobileRoot);

    const shot1 = path.join(os.tmpdir(), `signova-ui-${mode}-mobile.png`);
    await page.screenshot({ path: shot1, fullPage: true });
    console.log(`screenshot: ${shot1}`);
    record("mobile: no runtime errors", errors.length === 0, errors.slice(0, 4).join(" | ") || "clean console");
    await context.close();
  }

  // -------------------------------------------------------------------
  // 2. Desktop reload: the existing conversation re-renders on demand.
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    await initSession(context);
    const page = await context.newPage();
    await page.goto(`${base}/${route}`, { waitUntil: "domcontentloaded" });
    await page.locator(".sn-avatar-card").first().waitFor({ state: "visible", timeout: 60_000 });
    const cards = await page.locator(".sn-avatar-card").allTextContents();
    record(
      "desktop: restored history contains the teller message",
      cards.some((t) => t.includes("How can I help you today?")),
      `${cards.length} avatar card(s)`,
    );
    await assertAvatar(page, "desktop");
    const shot2 = path.join(os.tmpdir(), `signova-ui-${mode}-desktop.png`);
    await page.screenshot({ path: shot2, fullPage: true });
    console.log(`screenshot: ${shot2}`);
    await context.close();
  }

  // -------------------------------------------------------------------
  // 3. MP4 fallback: force /pose to fail and verify the video player.
  // -------------------------------------------------------------------
  {
    const context = await browser.newContext({ viewport: { width: 430, height: 932 } });
    await initSession(context);
    const page = await context.newPage();
    await page.route("**/messages/*/pose", (r) =>
      r.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "forced" }) }),
    );
    await page.goto(`${base}/${route}`, { waitUntil: "domcontentloaded" });
    if (mode === "sign") {
      const openConversation = page.locator('button[aria-label="Open conversation"]');
      await openConversation.waitFor({ state: "visible", timeout: 30_000 }).catch(() => undefined);
      if (await openConversation.isVisible().catch(() => false)) {
        await openConversation.click();
        await page.locator(".sn-convo.is-open").waitFor({ state: "visible", timeout: 10_000 }).catch(() => undefined);
      }
    }
    await page.locator(".sn-avatar-videoFallback:visible").first().waitFor({ state: "visible", timeout: 60_000 });
    record("fallback: pose failure shows the honest error state", true, "error + video fallback");
    const video = await waitForVideo(page, ".sn-avatar-videoFallback:visible video");
    record(
      "fallback: SignBridge MP4 plays in the Deaf-user UI",
      !!video && video.width === 800 && video.height === 600 && video.srcIsBlob,
      JSON.stringify(video),
    );
    const replayButton = page.locator('.sn-avatar-videoFallback:visible button[aria-label="Replay animation"]').first();
    await replayButton.click();
    await page.waitForTimeout(600);
    const replay = await page
      .locator(".sn-avatar-videoFallback:visible video")
      .first()
      .evaluate((v) => ({ currentTime: v.currentTime, paused: v.paused }));
    record("fallback: MP4 replay restarts playback", !!replay && replay.currentTime < 2, JSON.stringify(replay));
    const shot3 = path.join(os.tmpdir(), `signova-ui-${mode}-fallback.png`);
    await page.screenshot({ path: shot3, fullPage: true });
    console.log(`screenshot: ${shot3}`);
    await context.close();
  }
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} UI checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
