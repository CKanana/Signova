import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { chromium } from "playwright";

const cfg = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), "signova_staff_ui.json"), "utf8"));
const results = [];
function record(name, ok, detail) {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name} — ${detail}`);
}

const browser = await chromium.launch();
try {
  // ---- Staff dashboard context ----
  const staffContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  await staffContext.addInitScript(
    ({ token, user }) => {
      sessionStorage.setItem("signova.staff.accessToken", token);
      sessionStorage.setItem("signova.staff.refreshToken", "audit-refresh-token");
      sessionStorage.setItem("signova.staff.user", JSON.stringify(user));
    },
    { token: cfg.staffToken, user: cfg.staffUser },
  );
  const staff = await staffContext.newPage();
  staff.on("pageerror", (e) => console.log("STAFF PAGEERROR", e.message));
  await staff.goto("http://localhost:5173/staff/session", { waitUntil: "domcontentloaded" });
  await staff.waitForSelector("#staff-reply", { timeout: 45_000 });
  record("staff: authenticated workspace restores the active session", true, "composer ready");

  await staff.locator(".staff-msg--user .staff-msg__text", { hasText: "My card was declined" }).first().waitFor({ state: "visible", timeout: 30_000 });
  record("staff: Deaf-user message appears in the correct conversation", true, "My card was declined");

  // ---- Deaf PWA context ----
  const pwaContext = await browser.newContext({ viewport: { width: 430, height: 932 } });
  await pwaContext.addInitScript(
    ({ token, deviceId, session }) => {
      localStorage.setItem("signova.accessToken", token);
      localStorage.setItem("signova.device.id.v1", deviceId);
      localStorage.setItem("signova.session", JSON.stringify(session));
    },
    {
      token: cfg.deafToken,
      deviceId: cfg.deviceId,
      session: { sessionId: cfg.sessionId, tellerId: cfg.tellerId, method: "text", createdAt: Date.now() },
    },
  );
  const pwa = await pwaContext.newPage();
  pwa.on("pageerror", (e) => console.log("PWA PAGEERROR", e.message));
  pwa.on("console", (m) => {
    if (m.type() === "error") console.log("PWA CONSOLE", m.text().slice(0, 180));
  });
  await pwa.goto("http://localhost:5175/text", { waitUntil: "domcontentloaded" });
  await pwa.waitForFunction(
    () => document.body.innerText.includes("My card was declined"),
    undefined,
    { timeout: 30_000 },
  );
  record("pwa: Deaf-user conversation is open", true, pwa.url());

  // ---- Teller sends a reply from the real UI ----
  await staff.fill("#staff-reply", "How can I help you today?");
  await staff.locator('.staff-composer button[type="submit"]').click();
  await staff.waitForSelector(".staff-msg--staff:has-text('How can I help you today?')", { timeout: 30_000 });
  await staff.waitForTimeout(1500);
  const pendingCount = await staff.locator(".staff-msg--staff:has-text('How can I help you today?')").count();
  record("staff: reply is confirmed exactly once (no optimistic duplicate)", pendingCount === 1, `${pendingCount} staff bubble(s)`);

  await pwa.getByText("How can I help you today?", { exact: false }).last().waitFor({ state: "attached", timeout: 30_000 });
  record("pwa: teller reply arrives in real time", true, "text delivered over Socket.IO");

  await pwa.waitForSelector(".sn-avatar-card:visible", { timeout: 30_000 });
  await pwa.waitForSelector(".sn-avatar-card:visible .sn-avatar-stage svg", { timeout: 120_000 });
  const avatar = await pwa.evaluate(() => {
    const stage = document.querySelector(".sn-avatar-card .sn-avatar-stage");
    return {
      nodes: stage?.querySelector("svg")?.querySelectorAll("*").length || 0,
      label: stage?.getAttribute("aria-label") || "",
    };
  });
  record(
    "pwa: the teller reply is animated by the 2D signer",
    avatar.nodes > 10 && avatar.label.includes("2D signer"),
    `svgNodes=${avatar.nodes} label=${avatar.label}`,
  );

  // ---- Confirm persisted animation + playable MP4 ----
  let animation = null;
  let persistedReplies = 0;
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    const res = await fetch(`http://localhost:4000/api/sessions/${cfg.sessionId}/messages`, {
      headers: { authorization: `Bearer ${cfg.deafToken}` },
    });
    const body = await res.json();
    const replies = body.messages.filter(
      (m) => m.sender === "STAFF" && m.text === "How can I help you today?",
    );
    persistedReplies = replies.length;
    const reply = replies[0];
    if (reply?.animation?.status === "ready") {
      animation = reply.animation;
      break;
    }
    await pwa.waitForTimeout(1000);
  }
  record(
    "backend: the reply is persisted exactly once",
    persistedReplies === 1,
    `${persistedReplies} persisted staff message(s)`,
  );
  record("backend: reply animation is ready", !!animation && !!animation.url, JSON.stringify(animation));
  if (animation?.url) {
    const video = await fetch(`http://localhost:4000${animation.url}`, {
      headers: { authorization: `Bearer ${cfg.deafToken}` },
    });
    const bytes = Buffer.from(await video.arrayBuffer());
    record(
      "backend: animation MP4 is streamable",
      video.status === 200 && bytes.length > 10_000,
      `status=${video.status} bytes=${bytes.length}`,
    );
  }

  const staffShot = path.join(os.tmpdir(), "signova-staff-session.png");
  const pwaShot = path.join(os.tmpdir(), "signova-pwa-from-staff.png");
  await staff.screenshot({ path: staffShot, fullPage: true });
  await pwa.screenshot({ path: pwaShot, fullPage: true });
  console.log(`screenshots: ${staffShot} ${pwaShot}`);

  await staffContext.close();
  await pwaContext.close();
} finally {
  await browser.close();
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length === 0 ? 0 : 1);
